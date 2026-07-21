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

// Groq's free tier requires no billing/card setup at all, unlike Gemini's
// current quota policy. llama-3.3-70b-versatile gives GPT-4o-class quality
// for this "read files, summarize, extract" task. Note: Groq's free-tier
// TPM (tokens-per-minute) ceiling is tighter than Gemini's, so very large
// file batches may need to be chunked by the caller — see MAX_OUTPUT_TOKENS.
const MODEL = 'llama-3.3-70b-versatile';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_OUTPUT_TOKENS = 8000;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly apiKey: string | null;

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

  /**
   * Sends a batch of source files to Groq (Llama 3.3 70B) and asks it to
   * return structured notes (summaries/explanations) and snippets (reusable
   * code blocks) as JSON.
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
- Do not invent information that isn't supported by the provided file contents.`;

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
