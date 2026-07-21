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

// Groq's OpenAI-compatible chat completions endpoint.
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
// A strong, fast, free-tier-available Groq model — plenty for this bounded
// "read files, summarize, extract" task.
const MODEL = 'llama-3.3-70b-versatile';
// Groq's free tier caps at 12,000 tokens PER MINUTE, shared across the whole
// account/org — and `max_tokens` reserves that much against the cap up front,
// regardless of how much output is actually used. Keeping this modest leaves
// real headroom for the input tokens in the same request.
const MAX_OUTPUT_TOKENS = 3000;

// Retry transient failures (rate limits, momentary 5xx) automatically so a
// single click on "Import" succeeds without the user needing to retry by hand.
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = [2000, 5000]; // backoff between attempts 1→2 and 2→3

// Hard ceiling well under the "import should take at most ~5 minutes" target —
// fails fast with a clear error instead of hanging indefinitely if something's wrong.
const REQUEST_TIMEOUT_MS = 90_000;

// Groq's free tier: 12,000 tokens/minute, shared across the whole account.
// Keep a safety margin below the real cap since our token estimate is
// approximate (based on character count, not the model's actual tokenizer).
const SAFE_TPM_BUDGET = 10_000;
const RATE_WINDOW_MS = 61_000; // slightly over 60s, to be safely inside Groq's rolling window

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly apiKey: string | null;

  // Tracks {timestamp, estimatedTokens} for requests sent in the trailing window,
  // so we can proactively wait before a request that would blow the TPM budget,
  // rather than sending it, getting a 429, and retrying after the fact.
  private recentUsage: { time: number; tokens: number }[] = [];

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

  private estimateTokens(text: string): number {
    // Rough estimate — code tends to run ~3-3.5 chars/token, not the ~4 chars/token
    // rule of thumb for prose. Erring toward overestimating is safer here (it just
    // means slightly more conservative pacing, not a surprise 429).
    return Math.ceil(text.length / 3);
  }

  /** Waits, if needed, until sending `tokens` more would stay within the rolling TPM budget. */
  private async waitForBudget(tokens: number): Promise<void> {
    for (;;) {
      const now = Date.now();
      this.recentUsage = this.recentUsage.filter((u) => now - u.time < RATE_WINDOW_MS);
      const used = this.recentUsage.reduce((sum, u) => sum + u.tokens, 0);

      if (used + tokens <= SAFE_TPM_BUDGET) {
        this.recentUsage.push({ time: now, tokens });
        return;
      }

      // Wait until the oldest entry falls out of the window, then re-check.
      const oldest = this.recentUsage[0];
      const waitMs = oldest ? RATE_WINDOW_MS - (now - oldest.time) + 250 : 1000;
      this.logger.log(
        `Pacing Groq requests: waiting ~${Math.round(waitMs / 1000)}s to stay under the free-tier rate limit`,
      );
      await new Promise((resolve) => setTimeout(resolve, Math.max(waitMs, 250)));
    }
  }

  /**
   * Sends a batch of source files to Groq and asks it to return structured
   * notes (summaries/explanations) and snippets (reusable code blocks) as JSON.
   * Retries automatically on transient failures (429/5xx/timeout) so the
   * caller only needs to try once.
   */
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
- Do not invent information that isn't supported by the provided file contents.
- Respond with valid JSON only.`;

    let lastError: Error | null = null;
    const estimatedTokens = this.estimateTokens(systemPrompt) + this.estimateTokens(fileBlocks) + MAX_OUTPUT_TOKENS;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      await this.waitForBudget(estimatedTokens);
      try {
        const text = await this.callGroq(systemPrompt, fileBlocks);
        return this.parseJson(text);
      } catch (err) {
        lastError = err as Error;
        const isLastAttempt = attempt === MAX_ATTEMPTS;
        this.logger.warn(
          `Groq call attempt ${attempt}/${MAX_ATTEMPTS} failed: ${lastError.message}` +
            (isLastAttempt ? ' — giving up.' : ' — retrying...'),
        );
        if (!isLastAttempt) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS[attempt - 1]));
        }
      }
    }

    throw new InternalServerErrorException(
      `AI analysis failed after ${MAX_ATTEMPTS} attempts: ${lastError?.message ?? 'unknown error'}`,
    );
  }

  private async callGroq(systemPrompt: string, fileBlocks: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: MODEL,
          max_tokens: MAX_OUTPUT_TOKENS,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: fileBlocks },
          ],
        }),
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new Error(`Groq request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`);
      }
      throw new Error(`Groq request failed to send: ${(err as Error).message}`);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Groq API returned ${response.status}: ${body.slice(0, 500)}`);
    }

    const data = await response.json();
    const text: string | undefined = data?.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error(`Unexpected Groq response shape: ${JSON.stringify(data).slice(0, 500)}`);
    }
    return text;
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
