import { HttpStatus, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ImportJobStatus, ImportStage, Prisma } from '@prisma/client';
import { AiRepoAnalysis, AiService, AnalyzedFile } from '../ai/ai.service';
import { ApiException } from '../common/errors/api-exception';
import { ErrorCode } from '../common/errors/error-codes';
import { TokenCryptoService } from '../common/security/token-crypto.service';
import { env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { ImportRepoDto } from './dto/import-repo.dto';

const GITHUB_API = 'https://api.github.com';

/** Directory *segments* that never contain source worth analyzing. */
const SKIP_DIR_SEGMENTS = [
  'node_modules', 'dist', 'build', '.git', '.next', '.nuxt', '.turbo',
  'coverage', '.cache', 'vendor', 'out', 'target', '.venv', '__pycache__',
];

const SKIP_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.avif', '.bmp',
  '.woff', '.woff2', '.ttf', '.eot', '.otf', '.pdf', '.zip', '.gz', '.map',
  '.lock', '.mp4', '.webm', '.mp3', '.wav', '.ogg', '.mov', '.so', '.dylib',
  '.dll', '.exe', '.class', '.jar', '.pyc',
];

const SKIP_FILENAMES = [
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb',
  'Cargo.lock', 'Gemfile.lock', 'poetry.lock', 'composer.lock', 'go.sum',
  'LICENSE', '.editorconfig',
];

// With Groq's free-tier pacing (see AiService) landing at roughly one batch
// request per ~60s, this cap keeps a typical import to a handful of batches.
// It is a real trade-off, not just an optimization: bigger repositories are
// truncated to this budget (shallow, small files first) rather than processed
// in full, so an import stays predictable instead of open-ended.
const MAX_FILES = 60;
const MAX_FILE_BYTES = 8_000;
const MAX_TOTAL_CHARS = 50_000;
/** GitHub refuses to serve blobs past 100 MB and returns empty ones past ~1 MB. */
const MAX_BLOB_SIZE = 200_000;

const BATCH_CHAR_BUDGET = 14_000;
const BATCH_CONCURRENCY = 1; // must stay 1 — AiService paces itself against the account TPM budget

/** How many GitHub requests to run at once while fetching file contents. */
const FETCH_CONCURRENCY = 8;
/** Bounded retry on GitHub 429/5xx — enough for a blip, not enough to hang. */
const GITHUB_MAX_ATTEMPTS = 3;
/** At most one progress write per this interval, so a 60-file import isn't 60 UPDATEs. */
const PROGRESS_WRITE_INTERVAL_MS = 800;

interface GithubTreeEntry {
  path: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
}

/** The fields every job response exposes — one place, so polling and resuming agree. */
const JOB_SELECT = {
  id: true,
  userId: true,
  projectId: true,
  repoOwner: true,
  repoName: true,
  repoFullName: true,
  branch: true,
  status: true,
  stage: true,
  stageLabel: true,
  progress: true,
  totalFiles: true,
  processedFiles: true,
  currentFile: true,
  totalBatches: true,
  completedBatches: true,
  notesCreated: true,
  snippetsCreated: true,
  tasksCreated: true,
  filesAnalyzed: true,
  warning: true,
  error: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  project: { select: { id: true, name: true, description: true, sourceRepo: true } },
} satisfies Prisma.ImportJobSelect;

type ImportJobRow = Prisma.ImportJobGetPayload<{ select: typeof JOB_SELECT }>;

/** Everything the background pipeline needs, resolved before the HTTP request returned. */
interface JobContext {
  jobId: string;
  userId: string;
  /** Decrypted GitHub token for the importing user. Never leaves the service. */
  token: string;
  owner: string;
  repoName: string;
  branch: string;
  /** The repository object GitHub returned for `GET /repos/{owner}/{repo}`. */
  repoMeta: Record<string, unknown>;
}

/** What `POST /import/github` and the status endpoints hand back. */
export interface ImportJobDto {
  jobId: string;
  status: ImportJobStatus;
  stage: ImportStage;
  stageLabel: string;
  progress: number;
  repoFullName: string;
  branch: string | null;
  totalFiles: number;
  processedFiles: number;
  currentFile: string | null;
  totalBatches: number;
  completedBatches: number;
  result: {
    project: { id: string; name: string; description: string | null; sourceRepo: string | null };
    filesAnalyzed: number;
    notesCreated: number;
    snippetsCreated: number;
    tasksCreated: number;
  } | null;
  warning: string | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

function batchFiles(files: AnalyzedFile[], charBudget: number): AnalyzedFile[][] {
  const batches: AnalyzedFile[][] = [];
  let current: AnalyzedFile[] = [];
  let currentChars = 0;

  for (const file of files) {
    if (currentChars > 0 && currentChars + file.content.length > charBudget) {
      batches.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(file);
    currentChars += file.content.length;
  }
  if (current.length > 0) batches.push(current);

  return batches;
}

/** Runs `items` through `worker` with at most `concurrency` running at once. */
async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function runNext(): Promise<void> {
    const i = nextIndex++;
    if (i >= items.length) return;
    results[i] = await worker(items[i], i);
    await runNext();
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runNext());
  await Promise.all(workers);
  return results;
}

/**
 * Coalesces progress updates. Files are fetched 8 at a time, so without this a
 * 60-file import would fire 60 UPDATEs for information nobody reads faster than
 * the 2s poll. The newest patch always wins, and `flush()` at every stage
 * boundary guarantees the terminal states are written immediately.
 */
class ProgressWriter {
  private pending: Prisma.ImportJobUpdateInput = {};
  private timer: NodeJS.Timeout | null = null;
  private inFlight: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobId: string,
    private readonly logger: Logger,
  ) {}

  set(patch: Prisma.ImportJobUpdateInput): void {
    this.pending = { ...this.pending, ...patch };
    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.timer = null;
        void this.write();
      }, PROGRESS_WRITE_INTERVAL_MS);
    }
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.write();
    await this.inFlight;
  }

  private async write(): Promise<void> {
    if (Object.keys(this.pending).length === 0) return;
    const patch = this.pending;
    this.pending = {};
    this.inFlight = this.prisma.importJob
      .update({ where: { id: this.jobId }, data: patch })
      .catch((err: unknown) =>
        // A progress write failing must never be what kills an import.
        this.logger.warn(`Could not persist progress for import ${this.jobId}: ${(err as Error).message}`),
      );
    await this.inFlight;
  }
}

/**
 * How long a `SIGTERM` is given to let running imports finish before they are
 * written off as failed. Long enough for a batch boundary in practice, short
 * enough that a shutdown is not held open by a wedged upstream request.
 */
const SHUTDOWN_GRACE_MS = 15_000;

@Injectable()
export class ImportService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ImportService.name);

  /**
   * The jobs this process is running right now. Tracked for two reasons that
   * look unrelated but are the same one: shutdown needs to know what is still
   * in flight, and a test (or a caller) needs a way to await a background job
   * that `startImport` deliberately did not keep it waiting for.
   */
  private readonly running = new Map<string, Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly tokenCrypto: TokenCryptoService,
  ) {}

  /**
   * Import work runs in this process, so a restart leaves rows stuck in
   * PENDING/PROCESSING that nothing will ever finish. On boot they are marked
   * failed with the honest reason, instead of a client polling a job that is
   * never going to move.
   */
  async onApplicationBootstrap(): Promise<void> {
    try {
      const { count } = await this.prisma.importJob.updateMany({
        where: { status: { in: [ImportJobStatus.PENDING, ImportJobStatus.PROCESSING] } },
        data: {
          status: ImportJobStatus.FAILED,
          stage: ImportStage.FAILED,
          stageLabel: 'Failed',
          completedAt: new Date(),
          error: 'The API server restarted while this import was running. Start it again.',
        },
      });
      if (count > 0) this.logger.warn(`Marked ${count} interrupted import job(s) as failed`);
    } catch (err) {
      this.logger.error(`Could not recover interrupted import jobs: ${(err as Error).message}`);
    }
  }

  // ─── GitHub plumbing ───────────────────────────────────────────────────────

  /** The user's GitHub token, decrypted. Never returned to a caller. */
  private async getGithubToken(userId: string): Promise<string> {
    const account = await this.prisma.oAuthAccount.findFirst({
      where: { userId, provider: 'github' },
      select: { accessToken: true },
    });
    if (!account?.accessToken) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.GITHUB_NOT_CONNECTED,
        'Connect your GitHub account first (Settings → Sign in with GitHub) before importing a repository.',
      );
    }
    try {
      return this.tokenCrypto.decrypt(account.accessToken) ?? '';
    } catch {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.GITHUB_TOKEN_EXPIRED,
        'Your stored GitHub token could not be decrypted. Reconnect GitHub and try again.',
      );
    }
  }

  /**
   * One GitHub GET with bounded retries.
   *
   * Retries only what can plausibly succeed the next time (network failure,
   * 429, 5xx) and honours `Retry-After`, which is the difference between a
   * primary-rate-limited import that pauses and one that hammers GitHub and
   * gets secondary-limited for an hour. Errors are mapped to a code + a
   * message safe to show; the response body only ever reaches the log.
   */
  private async githubFetch<T = Record<string, unknown>>(path: string, token: string): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= GITHUB_MAX_ATTEMPTS; attempt++) {
      let res: Response;
      try {
        res = await fetch(`${GITHUB_API}${path}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        });
      } catch (err) {
        lastError = err as Error;
        if (attempt < GITHUB_MAX_ATTEMPTS) await sleep(1000 * attempt);
        continue;
      }

      if (res.ok) {
        return (await res.json()) as T;
      }

      if (res.status === 401 || res.status === 403) {
        throw new ApiException(
          HttpStatus.BAD_REQUEST,
          ErrorCode.GITHUB_TOKEN_EXPIRED,
          'Your GitHub connection has expired or lacks the required permissions. Reconnect GitHub and try again.',
        );
      }
      if (res.status === 404) {
        throw new ApiException(
          HttpStatus.NOT_FOUND,
          ErrorCode.REPOSITORY_NOT_FOUND,
          'GitHub could not find that repository. Check the owner and name (and that your GitHub account can see it).',
        );
      }
      if (res.status === 409) {
        throw new ApiException(
          HttpStatus.BAD_REQUEST,
          ErrorCode.REPOSITORY_EMPTY,
          'That repository is empty, so there is nothing to import.',
        );
      }

      lastError = new Error(`GitHub API request failed (${res.status})`);
      const body = await res.text().catch(() => '');
      this.logger.error(`GitHub API ${res.status} for ${path}: ${body.slice(0, 300)}`);

      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < GITHUB_MAX_ATTEMPTS) {
        await sleep(githubRetryDelayMs(res.headers.get('retry-after'), attempt));
        continue;
      }
      if (res.status === 429) {
        throw new ApiException(
          HttpStatus.TOO_MANY_REQUESTS,
          ErrorCode.GITHUB_API_FAILED,
          'GitHub is rate-limiting these requests. Wait a few minutes and try again.',
        );
      }
      break;
    }

    throw new ApiException(
      HttpStatus.BAD_GATEWAY,
      ErrorCode.GITHUB_API_FAILED,
      lastError?.message ?? 'GitHub API request failed',
    );
  }

  async listRepos(userId: string) {
    const token = await this.getGithubToken(userId);
    const repos = await this.githubFetch<unknown[]>('/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator', token);
    return repos.map((entry) => {
      const r = entry as Record<string, any>;
      return {
        owner: r.owner?.login as string,
        name: r.name as string,
        fullName: r.full_name as string,
        description: (r.description as string | null) ?? null,
        private: Boolean(r.private),
        defaultBranch: r.default_branch as string,
        updatedAt: r.updated_at as string,
        language: (r.language as string | null) ?? null,
      };
    });
  }

  // ─── Job lifecycle ─────────────────────────────────────────────────────────

  /**
   * Validates the repository, persists a PENDING job, then starts the work in
   * the background and returns the id.
   *
   * This is deliberately not one long-held HTTP request: a real import takes
   * minutes (Groq's free tier forces pacing between batches) and browsers,
   * proxies and serverless platforms all kill connections well before that.
   * The client polls `getJobStatus`. Validating the repo *is* synchronous, so
   * a typo or an inaccessible repository is an immediate 400 instead of a job
   * row that quietly fails a second later.
   */
  async startImport(userId: string, dto: ImportRepoDto): Promise<{ jobId: string }> {
    if (!this.aiService.isConfigured) {
      throw new ApiException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.AI_NOT_CONFIGURED,
        'AI analysis is not configured — set GROQ_API_KEY in Backend/.env and restart the server.',
      );
    }

    // Two concurrent imports would interleave and compete for the same shared
    // Groq rate-limit budget, making both take far longer than either alone.
    const active = await this.prisma.importJob.findFirst({
      where: { userId, status: { in: [ImportJobStatus.PENDING, ImportJobStatus.PROCESSING] } },
      select: { id: true, repoFullName: true },
      orderBy: { createdAt: 'desc' },
    });
    if (active) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        ErrorCode.IMPORT_ALREADY_RUNNING,
        `You already have an import in progress (${active.repoFullName}). Wait for it to finish before starting another.`,
        { jobId: active.id },
      );
    }

    const token = await this.getGithubToken(userId);
    const repo = await this.githubFetch<Record<string, any>>(`/repos/${dto.owner}/${dto.repo}`, token);
    if (!repo?.full_name) {
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.REPOSITORY_NOT_FOUND, 'GitHub could not find that repository.');
    }

    const job = await this.prisma.importJob.create({
      data: {
        userId,
        repoOwner: dto.owner,
        repoName: dto.repo,
        repoFullName: repo.full_name as string,
        branch: dto.branch ?? (repo.default_branch as string) ?? null,
        status: ImportJobStatus.PENDING,
        stage: ImportStage.CONNECTED,
        stageLabel: 'Repository connected',
        progress: 5,
      },
      select: JOB_SELECT,
    });

    const context: JobContext = {
      jobId: job.id,
      userId,
      token,
      owner: dto.owner,
      repoName: dto.repo,
      branch: (repo.default_branch as string) ?? 'main',
      repoMeta: repo,
    };
    if (dto.branch) context.branch = dto.branch;

    const run = this.runJob(context).catch(async (err: unknown) => {
      // runJob handles its own failures; this is the belt-and-braces path for an
      // error thrown by the failure handling itself, so a job can never be left
      // PENDING/PROCESSING by an exception nobody caught.
      this.logger.error(`Import job ${job.id} crashed outside its error handling`, err as Error);
      await this.prisma.importJob
        .update({
          where: { id: job.id },
          data: {
            status: ImportJobStatus.FAILED,
            stage: ImportStage.FAILED,
            stageLabel: 'Failed',
            completedAt: new Date(),
            error: 'The import stopped unexpectedly.',
          },
        })
        .catch(() => undefined);
    });

    this.running.set(job.id, run);
    // Settled jobs are forgotten; the row in the database is the record.
    void run.finally(() => this.running.delete(job.id));

    return { jobId: job.id };
  }

  /** Resolves once nothing is running. Tests use it; so does shutdown. */
  async whenIdle(): Promise<void> {
    await Promise.all([...this.running.values()]);
  }

  /**
   * On `SIGTERM`, give in-flight imports a grace period to reach a sane end.
   * Anything still running afterwards is marked failed here rather than left
   * for the next boot to notice — so a user watching the progress bar learns
   * immediately that they need to restart the import.
   */
  async onApplicationShutdown(): Promise<void> {
    const pending = [...this.running.keys()];
    if (pending.length === 0) return;

    this.logger.log(`Waiting up to ${SHUTDOWN_GRACE_MS / 1000}s for ${pending.length} import(s) to finish`);

    await Promise.race([
      this.whenIdle(),
      sleep(SHUTDOWN_GRACE_MS).then(() => undefined),
    ]);

    const stillRunning = [...this.running.keys()];
    if (stillRunning.length === 0) return;

    await this.prisma.importJob
      .updateMany({
        where: { id: { in: stillRunning }, status: { in: [ImportJobStatus.PENDING, ImportJobStatus.PROCESSING] } },
        data: {
          status: ImportJobStatus.FAILED,
          stage: ImportStage.FAILED,
          stageLabel: 'Failed',
          completedAt: new Date(),
          error: 'The API server shut down while this import was running. Start it again.',
        },
      })
      .catch(() => undefined);
  }

  /** Poll one job. Ownership is part of the lookup, so another user's id is a 404. */
  async getJobStatus(userId: string, jobId: string): Promise<ImportJobDto> {
    const job = await this.prisma.importJob.findFirst({ where: { id: jobId, userId }, select: JOB_SELECT });
    if (!job) {
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.IMPORT_JOB_NOT_FOUND, 'Import job not found');
    }
    return this.toDto(job);
  }

  /**
   * The caller's most recent job, running or not — this is what makes an import
   * survive navigating away, closing the tab, or a page refresh: the client
   * asks "do I have a job?" on mount and resumes showing real backend state.
   */
  async getLatestJob(userId: string): Promise<ImportJobDto | null> {
    const job = await this.prisma.importJob.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: JOB_SELECT,
    });
    return job ? this.toDto(job) : null;
  }

  private toDto(job: ImportJobRow): ImportJobDto {
    const finished = job.status === ImportJobStatus.COMPLETED;
    return {
      jobId: job.id,
      status: job.status,
      stage: job.stage,
      stageLabel: job.stageLabel,
      progress: job.progress,
      repoFullName: job.repoFullName,
      branch: job.branch,
      totalFiles: job.totalFiles,
      processedFiles: job.processedFiles,
      currentFile: job.currentFile,
      totalBatches: job.totalBatches,
      completedBatches: job.completedBatches,
      result:
        finished && job.project
          ? {
              project: job.project,
              filesAnalyzed: job.filesAnalyzed,
              notesCreated: job.notesCreated,
              snippetsCreated: job.snippetsCreated,
              tasksCreated: job.tasksCreated,
            }
          : null,
      warning: job.warning,
      error: job.error,
      startedAt: job.startedAt?.toISOString() ?? null,
      completedAt: job.completedAt?.toISOString() ?? null,
      createdAt: job.createdAt.toISOString(),
    };
  }

  /**
   * Runs the pipeline under a wall-clock deadline. A stalled GitHub or Groq
   * request would otherwise hold a job in PROCESSING forever — and a job that
   * never terminates is a spinner that never stops on someone's screen.
   */
  private async runJob(context: JobContext): Promise<void> {
    const { jobId } = context;
    const progress = new ProgressWriter(this.prisma, jobId, this.logger);
    const warnings: string[] = [];

    let timer: NodeJS.Timeout | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new ApiException(
              HttpStatus.GATEWAY_TIMEOUT,
              ErrorCode.IMPORT_TIMEOUT,
              `This import exceeded the ${Math.round(env.importTimeoutMs / 60_000)} minute limit and was stopped. Try a smaller repository.`,
            ),
          ),
        env.importTimeoutMs,
      );
    });

    try {
      await Promise.race([this.runPipeline(context, progress, warnings), deadline]);
      await progress.flush();
    } catch (err) {
      await progress.flush();
      await this.failJob(jobId, err);
      this.logger.error(
        `Import job ${jobId} failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}`,
      );
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async failJob(jobId: string, err: unknown): Promise<void> {
    await this.prisma.importJob
      .update({
        where: { id: jobId },
        data: {
          status: ImportJobStatus.FAILED,
          stage: ImportStage.FAILED,
          stageLabel: 'Failed',
          completedAt: new Date(),
          // Safe for a user to read; the raw error is in the log.
          error: this.safeErrorMessage(err),
        },
      })
      .catch((writeErr: unknown) =>
        this.logger.error(`Could not persist failure for import ${jobId}: ${(writeErr as Error).message}`),
      );
  }

  private async runPipeline(
    context: JobContext,
    progress: ProgressWriter,
    warnings: string[],
  ): Promise<void> {
    const { jobId, userId, token, owner, repoName, branch, repoMeta } = context;

    await this.prisma.importJob.update({
      where: { id: jobId },
      data: { status: ImportJobStatus.PROCESSING, startedAt: new Date() },
    });
    progress.set({ stage: ImportStage.READING, stageLabel: 'Reading repository', progress: 8 });

    const candidates = await this.readTree(owner, repoName, branch, token, warnings);
    progress.set({ totalFiles: candidates.length, stageLabel: `Reading ${candidates.length} files` });

    const files = await this.fetchFiles(owner, repoName, candidates, token, progress, warnings);
    if (files.length === 0) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.REPOSITORY_EMPTY,
        'No analyzable source files were found in this repository (after filtering out binaries, lockfiles and build output).',
      );
    }

    progress.set({ stage: ImportStage.ANALYZING, stageLabel: 'Analyzing files with AI', progress: 20 });
    const { analysis, failedBatches, totalBatches } = await this.analyzeInBatches(String(repoMeta.full_name ?? `${owner}/${repoName}`), files, progress);

    progress.set({ stage: ImportStage.SAVING, stageLabel: 'Saving notes, snippets and tasks', progress: 95 });
    const saved = await this.saveAnalysis(userId, jobId, repoMeta, analysis);

    await progress.flush();
    await this.prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: ImportJobStatus.COMPLETED,
        stage: ImportStage.COMPLETED,
        stageLabel: 'Completed',
        progress: 100,
        completedAt: new Date(),
        projectId: saved.projectId,
        filesAnalyzed: files.length,
        notesCreated: analysis.notes.length,
        snippetsCreated: analysis.snippets.length,
        tasksCreated: analysis.tasks.length,
        // A partially analyzed import still says so: a green tick that hides
        // "3 of 5 batches failed" would be a lie.
        warning: [
          ...warnings,
          ...(failedBatches > 0
            ? [`${failedBatches} of ${totalBatches} analysis batches failed, so some files are missing from this import.`]
            : []),
        ].join(' ') || null,
        error: null,
      },
    });
  }

  /**
   * Only `ApiException` messages are echoed — those are written for users.
   * Anything else (a driver error, an upstream body, a `TypeError`) becomes one
   * generic sentence, because an unexpected error's message is exactly where
   * internals live.
   */
  private safeErrorMessage(err: unknown): string {
    if (err instanceof ApiException) return err.message;
    if (err instanceof Prisma.PrismaClientKnownRequestError) return 'The database rejected part of this import.';
    return 'The import stopped unexpectedly. Please try again.';
  }

  private async readTree(
    owner: string,
    repo: string,
    branch: string,
    token: string,
    warnings: string[],
  ): Promise<GithubTreeEntry[]> {
    const treeRes = await this.githubFetch<{ tree?: GithubTreeEntry[]; truncated?: boolean }>(
      `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      token,
    );

    if (treeRes.truncated) {
      // GitHub caps a recursive tree at 100k entries; when it truncates we are
      // looking at a partial listing, which is worth telling the user about
      // rather than silently importing "the first N files" forever.
      warnings.push('GitHub returned a truncated file listing for this repository, so very large repos are only partially analyzed.');
    }

    const entries = (treeRes.tree ?? []).filter(
      (e) =>
        e.type === 'blob' &&
        !this.shouldSkipPath(e.path) &&
        (e.size ?? 0) > 0 &&
        (e.size ?? 0) < MAX_BLOB_SIZE,
    );

    // Shallow, small files first: with a file budget this is what decides
    // whether the import sees the entry points and top-level structure (useful)
    // or 60 deeply nested leaf files (not).
    entries.sort((a, b) => {
      const depthDiff = a.path.split('/').length - b.path.split('/').length;
      if (depthDiff !== 0) return depthDiff;
      return (a.size ?? 0) - (b.size ?? 0);
    });

    return entries.slice(0, MAX_FILES);
  }

  private shouldSkipPath(path: string): boolean {
    const segments = path.split('/');
    if (segments.some((s) => SKIP_DIR_SEGMENTS.includes(s))) return true;
    const filename = segments[segments.length - 1];
    if (SKIP_FILENAMES.includes(filename)) return true;
    const lower = path.toLowerCase();
    if (SKIP_EXTENSIONS.some((ext) => lower.endsWith(ext))) return true;
    // Minified/bundled JS-CSS and generated API clients: noise, and huge.
    return /\.min\.(js|css)$/.test(lower) || /\.d\.ts$/.test(lower);
  }

  private async fetchFiles(
    owner: string,
    repo: string,
    entries: GithubTreeEntry[],
    token: string,
    progress: ProgressWriter,
    warnings: string[],
  ): Promise<AnalyzedFile[]> {
    let processed = 0;
    let skipped = 0;

    const fetched = await mapWithConcurrency(entries, FETCH_CONCURRENCY, async (entry) => {
      const content = await this.fetchBlob(owner, repo, entry.sha, token)
        .catch((err: unknown) => {
          // One unreadable file is not a failed import — the rest still gets
          // analyzed, and the count of skips is what the user is told.
          skipped += 1;
          this.logger.warn(`Skipping ${entry.path}: ${(err as Error).message}`);
          return null;
        })
        .finally(() => {
          processed += 1;
          progress.set({
            processedFiles: processed,
            currentFile: entry.path,
            // Reading spans 10%-20% of the bar; analysis owns the rest.
            progress: 10 + Math.round((processed / Math.max(entries.length, 1)) * 10),
          });
        });

      return content ? { path: entry.path, content } : null;
    });

    const files: AnalyzedFile[] = [];
    let totalChars = 0;
    for (const file of fetched) {
      if (!file) continue;
      if (totalChars >= MAX_TOTAL_CHARS) {
        skipped += 1;
        continue;
      }
      files.push(file);
      totalChars += file.content.length;
    }

    await progress.flush();
    if (skipped > 0) {
      warnings.push(`${skipped} file(s) could not be read or were too large and were skipped.`);
    }
    return files;
  }

  /** Fetches one blob, decodes it, and refuses anything that is not text. */
  private async fetchBlob(owner: string, repo: string, sha: string, token: string): Promise<string | null> {
    const blob = await this.githubFetch<{ encoding?: string; content?: string }>(
      `/repos/${owner}/${repo}/git/blobs/${sha}`,
      token,
    );
    if (blob.encoding !== 'base64' || !blob.content) return null;

    const decoded = Buffer.from(blob.content, 'base64');
    // GitHub truncates blobs past ~1 MB; an empty payload means "too big for
    // this endpoint", which is a skip, not a crash.
    if (decoded.length === 0) return null;
    if (isProbablyBinary(decoded)) return null;

    return decoded.toString('utf-8').replace(/\r\n/g, '\n').slice(0, MAX_FILE_BYTES);
  }

  private async analyzeInBatches(
    repoFullName: string,
    files: AnalyzedFile[],
    progress: ProgressWriter,
  ): Promise<{ analysis: AiRepoAnalysis; failedBatches: number; totalBatches: number }> {
    const batches = batchFiles(files, BATCH_CHAR_BUDGET);
    progress.set({ totalBatches: batches.length, completedBatches: 0 });

    this.logger.log(`Analyzing ${files.length} files across ${batches.length} batch(es) for ${repoFullName}`);

    const combined: AiRepoAnalysis = { notes: [], snippets: [], tasks: [] };
    let failedBatches = 0;

    // Sequential on purpose — see AiService for the rate-limit reason.
    //
    // A batch that fails (upstream outage, output we couldn't parse) is recorded
    // and skipped rather than aborting everything: an import that produced 4 of
    // 5 batches is worth keeping, and the job's `warning` says what's missing.
    for (let i = 0; i < batches.length; i++) {
      try {
        const result = await this.aiService.analyzeRepoFiles(repoFullName, batches[i]);
        combined.notes.push(...result.notes);
        combined.snippets.push(...result.snippets);
        combined.tasks.push(...result.tasks);
      } catch (err) {
        failedBatches += 1;
        this.logger.error(`Batch ${i + 1}/${batches.length} failed: ${(err as Error).message}`);
      }

      progress.set({
        completedBatches: i + 1,
        // Analysis spans 20%-95% of the bar.
        progress: 20 + Math.round(((i + 1) / batches.length) * 75),
        stageLabel: `Analyzing files with AI (batch ${i + 1} of ${batches.length})`,
      });
    }

    if (failedBatches === batches.length) {
      throw new ApiException(
        HttpStatus.BAD_GATEWAY,
        ErrorCode.AI_FAILED,
        'The AI service could not analyze any part of this repository. Please try again in a minute.',
      );
    }

    return { analysis: combined, failedBatches, totalBatches: batches.length };
  }

  private async saveAnalysis(
    userId: string,
    jobId: string,
    repo: Record<string, any>,
    analysis: AiRepoAnalysis,
  ): Promise<{ projectId: string }> {
    const project = await this.prisma.project.create({
      data: {
        userId,
        name: String(repo.name),
        description: (repo.description as string) || `Imported from ${repo.full_name}`,
        sourceRepo: repo.full_name as string,
      },
      select: { id: true },
    });

    const provenance = { generatedByAI: true, importJobId: jobId };

    await this.prisma.$transaction([
      ...(analysis.notes.length
        ? [
            this.prisma.note.createMany({
              data: analysis.notes.map((n) => ({
                userId,
                projectId: project.id,
                title: n.title,
                content: n.content,
                tags: n.tags ?? [],
                sourcePath: n.sourcePath ?? null,
                ...provenance,
              })),
            }),
          ]
        : []),
      ...(analysis.snippets.length
        ? [
            this.prisma.snippet.createMany({
              data: analysis.snippets.map((s) => ({
                userId,
                projectId: project.id,
                title: s.title,
                description: s.description,
                code: s.code,
                language: s.language || 'plaintext',
                tags: s.tags ?? [],
                sourcePath: s.sourcePath ?? null,
                ...provenance,
              })),
            }),
          ]
        : []),
      ...(analysis.tasks.length
        ? [
            this.prisma.task.createMany({
              data: analysis.tasks.map((t) => ({
                userId,
                projectId: project.id,
                title: t.title,
                description: t.description,
                status: t.status,
                priority: t.priority,
                sourcePath: t.sourcePath ?? null,
                ...provenance,
              })),
            }),
          ]
        : []),
    ]);

    return { projectId: project.id };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function githubRetryDelayMs(retryAfter: string | null, attempt: number): number {
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 30_000);
  return 1000 * attempt;
}

function isProbablyBinary(bytes: Buffer): boolean {
  // A NUL byte in the first 8 KB is the conventional test: real source files do
  // not contain one, compiled/asset blobs almost always do.
  const end = Math.min(bytes.length, 8000);
  for (let i = 0; i < end; i++) {
    if (bytes[i] === 0) return true;
  }
  return false;
}
