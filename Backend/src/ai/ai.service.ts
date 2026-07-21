import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';

export interface AnalyzedFile {
  path: string;
  content: string;
}

export interface AiNoteResult {
  title: string;
  content: string;
  tags: string[];
}

export interface AiSnippetResult {
  title: string;
  description?: string;
  code: string;
  language: string;
  tags: string[];
}

export interface AiRepoAnalysis {
  notes: AiNoteResult[];
  snippets: AiSnippetResult[];
}

const MODEL = 'llama-3.3-70b-versatile';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_OUTPUT_TOKENS = 3000;

const TPM_LIMIT = 10_000;
const CHARS_PER_TOKEN_ESTIMATE = 4;
const RATE_WINDOW_MS = 60_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly apiKey: string | null;

  private queue: Promise<void> = Promise.resolve();

  private usageLog: { time: number; tokens: number }[] = [];

  constructor() {
    const key = process.env.GROQ_API_KEY;
    if (!key) {
      this.logger.warn('GROQ_API_KEY not set — AI import features are disabled');
      this.apiKey = null;
    } else {
      this.apiKey = key;
    }
  }

  get isConfigured(): boolean {
    return this.apiKey !== null;
  }

  async analyzeRepoFiles(
    repoName: string,
    files: AnalyzedFile[],
  ): Promise<AiRepoAnalysis> {
    if (!this.apiKey) {
      throw new InternalServerErrorException(
        'AI analysis is not configured (missing GROQ_API_KEY)',
      );
    }

    const fileBlocks = files
      .map((f) => `--- FILE: ${f.path} ---\n${f.content}`)
      .join('\n\n');

    const systemPrompt = `You are a senior software engineer documenting a codebase for another developer.
You will be given the contents of several files from a repository called "${repoName}".

Respond with ONLY a single JSON object (no markdown fences, no prose before or after) matching exactly this shape:

{
  "notes": [
    { "title": string, "content": string, "tags": string[] }
  ],
  "snippets": [
    { "title": string, "description": string, "code": string, "language": string, "tags": string[] }
  ]
}

Rules:
- "notes": produce ONE note per file, unless two or more files are trivially small and tightly coupled (e.g. a barrel/index file re-exporting a sibling), in which case you may combine at most 2-3 such files into one note. Do NOT summarize the whole repo into a single note, and do NOT skip a file just because it seems minor — a short, honest note ("this file just re-exports X") is still better than omitting it. For a batch of N files, expect roughly N (or close to it) notes, not a small fraction of N.
- Each note should explain what the file/module does, how it fits into the project, and any gotchas or TODOs you notice — do not just restate the code line by line.
- "snippets": extract only genuinely reusable pieces (utility functions, hooks, config patterns, middleware, etc.) — not entire files verbatim. Keep each snippet focused and under ~40 lines. It's fine to return an empty array if nothing is genuinely reusable.
- "language" should be a lowercase identifier like "typescript", "javascript", "python", "css", "json".
- Keep "tags" short (1-4 words each), lowercase, relevant to topic/technology.
- Do not invent information that isn't supported by the provided file contents.`;

    const estimatedTokens =
      Math.ceil((systemPrompt.length + fileBlocks.length) / CHARS_PER_TOKEN_ESTIMATE) +
      MAX_OUTPUT_TOKENS;

    return this.enqueue(() => this.callGroq(systemPrompt, fileBlocks, estimatedTokens));
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async waitForBudget(estimatedTokens: number): Promise<void> {
    for (;;) {
      const now = Date.now();
      this.usageLog = this.usageLog.filter((e) => now - e.time < RATE_WINDOW_MS);
      const used = this.usageLog.reduce((sum, e) => sum + e.tokens, 0);

      if (used + estimatedTokens <= TPM_LIMIT) {
        this.usageLog.push({ time: now, tokens: estimatedTokens });
        return;
      }

      const oldest = this.usageLog[0];
      const waitMs = oldest ? RATE_WINDOW_MS - (now - oldest.time) + 500 : 2000;
      this.logger.log(
        `Groq token budget full (${used}/${TPM_LIMIT} used this minute) — waiting ${waitMs}ms before next call`,
      );
      await sleep(Math.max(waitMs, 500));
    }
  }

  private async callGroq(
    systemPrompt: string,
    fileBlocks: string,
    estimatedTokens: number,
    attempt = 1,
  ): Promise<AiRepoAnalysis> {
    await this.waitForBudget(estimatedTokens);

    let response: Response;
    try {
      response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: fileBlocks },
          ],
          max_tokens: MAX_OUTPUT_TOKENS,
          response_format: { type: 'json_object' },
        }),
      });
    } catch (err) {
      this.logger.error('Groq API call failed', err as Error);
      throw new InternalServerErrorException('AI analysis request failed');
    }

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Groq API returned ${response.status}: ${body}`);

      if (response.status === 429 && attempt === 1) {
        const match = body.match(/try again in ([\d.]+)s/i);
        const retryMs = match ? Math.ceil(parseFloat(match[1]) * 1000) + 1000 : 15_000;
        this.logger.warn(`Rate limited by Groq — retrying once in ${retryMs}ms`);
        await sleep(retryMs);
        return this.callGroq(systemPrompt, fileBlocks, estimatedTokens, attempt + 1);
      }

      throw new InternalServerErrorException(`AI analysis request failed (${response.status})`);
    }

    const data = await response.json();
    const text: string | undefined = data?.choices?.[0]?.message?.content;
    if (!text) {
      this.logger.error(`Unexpected Groq response shape: ${JSON.stringify(data).slice(0, 500)}`);
      throw new InternalServerErrorException('AI returned no analyzable content');
    }

    return this.parseJson(text);
  }

  private parseJson(raw: string): AiRepoAnalysis {
    const cleaned = raw.replace(/^```json\s*|\s*```$/g, '').trim();
    try {
      const parsed = JSON.parse(cleaned);
      return {
        notes: Array.isArray(parsed.notes) ? parsed.notes : [],
        snippets: Array.isArray(parsed.snippets) ? parsed.snippets : [],
      };
    } catch (err) {
      this.logger.error('Failed to parse AI response as JSON', err as Error);
      throw new InternalServerErrorException('AI returned malformed analysis data');
    }
  }
}
