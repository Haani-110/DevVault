import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ApiException } from '../common/errors/api-exception';
import { ErrorCode } from '../common/errors/error-codes';
import { env } from '../config/env';

export interface AnalyzedFile {
  path: string;
  content: string;
}

export interface AiNoteResult {
  title: string;
  content: string;
  tags: string[];
  /** Repository path the note describes, when the model identified one. */
  sourcePath?: string;
}

export interface AiSnippetResult {
  title: string;
  description?: string;
  code: string;
  language: string;
  tags: string[];
  sourcePath?: string;
}

export type AiTaskStatus = 'BACKLOG' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
export type AiTaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface AiTaskResult {
  title: string;
  description?: string;
  status: AiTaskStatus;
  priority: AiTaskPriority;
  sourcePath?: string;
}

export interface AiRepoAnalysis {
  notes: AiNoteResult[];
  snippets: AiSnippetResult[];
  tasks: AiTaskResult[];
}

// Groq's OpenAI-compatible chat completions endpoint.
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
// A strong, fast, free-tier-available Groq model — plenty for this bounded
// "read files, summarize, extract" task. Override with GROQ_MODEL if you have
// access to a bigger one.
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
// Groq's free tier caps at 12,000 tokens PER MINUTE, shared across the whole
// account — and `max_tokens` reserves that much against the cap up front,
// regardless of how much output is actually used. Keeping this modest leaves
// real headroom for the input tokens in the same request.
const MAX_OUTPUT_TOKENS = 3500;

// Bounded retries with backoff. Transient failures (429/5xx/timeout) get a
// second and third chance; everything else (400, 401, 404, content policy)
// fails immediately, because repeating it only burns the rate budget we just
// failed to respect.
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = [2000, 5000];
/** Ignore a `Retry-After` that asks for longer than this — it means "come back later", not "hang". */
const MAX_RETRY_AFTER_MS = 60_000;

// Hard ceiling well under the "import should take at most ~5 minutes" target —
// fails fast with a clear error instead of hanging indefinitely.
const REQUEST_TIMEOUT_MS = 90_000;

// Groq's free tier: 12,000 tokens/minute, shared across the whole account.
// Keep a safety margin below the real cap since our token estimate is
// approximate (character count, not the model's actual tokenizer).
const SAFE_TPM_BUDGET = 10_000;
const RATE_WINDOW_MS = 61_000; // slightly over 60s, so we stay inside the rolling window

const VALID_STATUSES = ['BACKLOG', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const;
const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly apiKey: string | undefined;
  private readonly model = env.groq.model || DEFAULT_MODEL;

  // Tracks {timestamp, estimatedTokens} for requests sent in the trailing
  // window, so we can proactively wait before a request that would blow the TPM
  // budget rather than sending it, getting a 429, and retrying after the fact.
  private recentUsage: { time: number; tokens: number }[] = [];

  constructor() {
    this.apiKey = env.groq.apiKey;
    if (!this.apiKey) {
      this.logger.warn('GROQ_API_KEY not set — AI import features are disabled');
    }
  }

  get isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  private estimateTokens(text: string): number {
    // Rough estimate — code runs ~3-3.5 chars/token, not the ~4 chars/token rule
    // of thumb for prose. Overestimating is the safe direction here (it just
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
      this.logger.log(`Pacing Groq requests: waiting ~${Math.round(waitMs / 1000)}s to stay under the free-tier rate limit`);
      await sleep(Math.max(waitMs, 250));
    }
  }

  /**
   * Sends a batch of source files to Groq and asks for structured notes,
   * snippets and tasks as JSON. Retries automatically on transient failures so
   * the caller only needs to try once.
   *
   * @throws ApiException(AI_NOT_CONFIGURED | AI_FAILED) — the message is always
   * safe to show a user: the raw upstream body stays in the log.
   */
  async analyzeRepoFiles(repoName: string, files: AnalyzedFile[]): Promise<AiRepoAnalysis> {
    if (!this.apiKey) {
      throw new ApiException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.AI_NOT_CONFIGURED,
        'AI analysis is not configured — set GROQ_API_KEY in Backend/.env and restart the server.',
      );
    }

    const fileBlocks = files.map((f) => `--- FILE: ${f.path} ---\n${f.content}`).join('\n\n');
    const systemPrompt = this.buildSystemPrompt(repoName, files.map((f) => f.path));
    const estimatedTokens =
      this.estimateTokens(systemPrompt) + this.estimateTokens(fileBlocks) + MAX_OUTPUT_TOKENS;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      await this.waitForBudget(estimatedTokens);
      try {
        const text = await this.callGroq(systemPrompt, fileBlocks);
        return this.parseAnalysis(text, new Set(files.map((f) => f.path)));
      } catch (err) {
        lastError = err as Error;
        const retryable = (err as GroqRequestError)?.retryable !== false;
        if (!retryable || attempt === MAX_ATTEMPTS) break;

        this.logger.warn(`Groq attempt ${attempt}/${MAX_ATTEMPTS} failed (${lastError.message}) — retrying`);
        const waitMs = (err as GroqRequestError)?.retryAfterMs ?? RETRY_DELAY_MS[attempt - 1];
        await sleep(waitMs);
      }
    }

    this.logger.error(`Groq analysis failed after ${MAX_ATTEMPTS} attempt(s): ${lastError?.message}`);
    throw new ApiException(
      HttpStatus.BAD_GATEWAY,
      ErrorCode.AI_FAILED,
      'The AI service could not analyze this batch of files. Please try again.',
    );
  }

  private buildSystemPrompt(repoName: string, paths: string[]): string {
    return `You are a senior software engineer documenting a codebase for another developer.
You will be given the contents of several files from a repository called "${repoName}".

Respond with ONLY a single JSON object (no markdown fences, no prose before or after) matching exactly this shape:

{
  "notes": [
    { "title": string, "content": string, "tags": string[], "sourcePath": string }
  ],
  "snippets": [
    { "title": string, "description": string, "code": string, "language": string, "tags": string[], "sourcePath": string }
  ],
  "tasks": [
    { "title": string, "description": string, "status": "BACKLOG" | "IN_PROGRESS" | "IN_REVIEW" | "DONE", "priority": "LOW" | "MEDIUM" | "HIGH" | "URGENT", "sourcePath": string }
  ]
}

Rules:
- "notes": produce ONE note per file, unless two or more files are trivially small and tightly coupled (e.g. a barrel/index file re-exporting a sibling), in which case you may combine at most 2-3 such files into one note. Do NOT summarize the whole repo into a single note, and do NOT skip a file just because it seems minor — a short, honest note ("this file just re-exports X") is still better than omitting it. For a batch of N files, expect roughly N (or close to it) notes, not a small fraction of N.
- Each note should explain what the file/module does, how it fits into the project, and any gotchas or TODOs you notice — do not just restate the code line by line.
- "snippets": extract only genuinely reusable pieces (utility functions, hooks, config patterns, middleware, etc.) — not entire files verbatim. Keep each snippet focused and under ~40 lines. It's fine to return an empty array if nothing is genuinely reusable.
- "language" should be a lowercase identifier like "typescript", "javascript", "python", "css", "json".
- Keep "tags" short (1-4 words each), lowercase, relevant to topic/technology.
- "sourcePath" must be the exact path of the file the item came from, copied from this list and nothing else: ${JSON.stringify(paths)}. If an item genuinely spans several files, use the most central one.
- "tasks": extract genuine, actionable follow-up work you can actually see evidence for in this code — TODO/FIXME comments, obviously incomplete/stubbed functions, missing error handling, or a clearly unfinished feature. Do NOT invent generic busywork ("write tests", "add documentation") unless the code specifically signals it's needed. It's fine to return an empty array if you don't see genuine signals.
- For each task's "status", use only what the code itself honestly shows you — you cannot know a team's real workflow state, so infer conservatively from code completeness:
  - "DONE" — only if the described functionality appears fully implemented and working in what you can see.
  - "IN_PROGRESS" — the code is partially implemented, has a stub, or a TODO mid-function suggesting active unfinished work.
  - "BACKLOG" — a TODO/FIXME comment describing work not yet started, or a gap you noticed but isn't begun.
  - "IN_REVIEW" — only use this if the code itself contains an explicit signal of that (e.g. a comment mentioning a pending review/PR) — otherwise avoid guessing this status.
- Do not invent information that isn't supported by the provided file contents.
- Respond with valid JSON only.`;
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
          model: this.model,
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
        throw new GroqRequestError(`Groq request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`, true);
      }
      throw new GroqRequestError(`Groq request failed to send: ${(err as Error).message}`, true);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      // 429/5xx are worth another attempt; a 4xx saying "bad request" or "bad
      // key" will still say that the third time, and each retry costs budget.
      const retryable = response.status === 429 || response.status === 408 || response.status >= 500;
      const retryAfterMs = parseRetryAfter(response.headers.get('retry-after'));
      const body = await response.text().catch(() => '');
      // Log the detail, throw a message safe to show.
      this.logger.error(`Groq returned ${response.status}: ${body.slice(0, 500)}`);
      throw new GroqRequestError(`Groq API returned ${response.status}`, retryable, retryAfterMs);
    }

    const data = await response.json().catch(() => null);
    const text: string | undefined = data?.choices?.[0]?.message?.content;
    if (!text) {
      // Do not echo the whole payload — it can contain request metadata.
      throw new GroqRequestError('Groq returned an unexpected response shape', false);
    }
    return text;
  }

  /**
   * Turns the model's JSON into the shapes the rest of the app needs, and drops
   * anything unusable instead of letting it reach the database: a note without
   * a title, a `sourcePath` that points at a file that was never sent, a task
   * status outside the Prisma enum. Malformed output is a *normal* outcome for
   * an LLM, so it must degrade into "less content" rather than a failed import.
   */
  private parseAnalysis(raw: string, knownPaths: Set<string>): AiRepoAnalysis {
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripCodeFence(raw));
    } catch {
      this.logger.error('AI response was not valid JSON');
      throw new ApiException(HttpStatus.BAD_GATEWAY, ErrorCode.AI_FAILED, 'The AI service returned malformed data. Please try again.');
    }

    const root = (parsed ?? {}) as Record<string, unknown>;

    return {
      notes: asArray(root.notes)
        .map((n) => this.toNote(n, knownPaths))
        .filter((n): n is AiNoteResult => n !== null),
      snippets: asArray(root.snippets)
        .map((s) => this.toSnippet(s, knownPaths))
        .filter((s): s is AiSnippetResult => s !== null),
      tasks: asArray(root.tasks)
        .map((t) => this.toTask(t, knownPaths))
        .filter((t): t is AiTaskResult => t !== null),
    };
  }

  private sourcePath(value: unknown, knownPaths: Set<string>): string | undefined {
    // An unverifiable path is worse than none: it would be shown to the user as
    // fact. Keep only exact matches against the files we actually sent.
    return typeof value === 'string' && knownPaths.has(value) ? value : undefined;
  }

  private tags(value: unknown): string[] {
    return asArray(value)
      .map((t) => (typeof t === 'string' ? t.trim().toLowerCase().slice(0, 40) : ''))
      .filter(Boolean)
      .slice(0, 20);
  }

  private toNote(value: unknown, knownPaths: Set<string>): AiNoteResult | null {
    const raw = (value ?? {}) as Record<string, unknown>;
    const title = text(raw.title, 200);
    const content = text(raw.content, 100_000);
    if (!title || !content) return null;
    return { title, content, tags: this.tags(raw.tags), sourcePath: this.sourcePath(raw.sourcePath, knownPaths) };
  }

  private toSnippet(value: unknown, knownPaths: Set<string>): AiSnippetResult | null {
    const raw = (value ?? {}) as Record<string, unknown>;
    const title = text(raw.title, 200);
    const code = text(raw.code, 100_000);
    if (!title || !code) return null;
    return {
      title,
      description: text(raw.description, 1000),
      code,
      // Must survive the snippet DTO's language pattern; the model is asked for
      // a lowercase identifier but "TypeScript (React)" is a plausible reply.
      language: (text(raw.language, 30) ?? 'plaintext').toLowerCase().replace(/[^a-z0-9+#.-]/g, '') || 'plaintext',
      tags: this.tags(raw.tags),
      sourcePath: this.sourcePath(raw.sourcePath, knownPaths),
    };
  }

  private toTask(value: unknown, knownPaths: Set<string>): AiTaskResult | null {
    const raw = (value ?? {}) as Record<string, unknown>;
    const title = text(raw.title, 200);
    if (!title) return null;
    const status = String(raw.status ?? '').toUpperCase();
    const priority = String(raw.priority ?? '').toUpperCase();
    return {
      title,
      description: text(raw.description, 2000),
      // Safe defaults beat crashing a whole import over one bad enum value.
      status: (VALID_STATUSES as readonly string[]).includes(status) ? (status as AiTaskStatus) : 'BACKLOG',
      priority: (VALID_PRIORITIES as readonly string[]).includes(priority) ? (priority as AiTaskPriority) : 'MEDIUM',
      sourcePath: this.sourcePath(raw.sourcePath, knownPaths),
    };
  }
}

class GroqRequestError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'GroqRequestError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

/** Models sometimes wrap JSON in a fence even when told not to. */
function stripCodeFence(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

/** `Retry-After` in seconds or as an HTTP date; undefined when absent/unparseable. */
function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return clampRetry(Math.round(seconds * 1000));

  const date = Date.parse(header);
  if (!Number.isNaN(date)) return clampRetry(date - Date.now());
  return undefined;
}

function clampRetry(ms: number): number {
  return Math.min(Math.max(ms, 0), MAX_RETRY_AFTER_MS);
}
