import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AiService, AnalyzedFile, AiRepoAnalysis } from '../ai/ai.service';
import { ImportRepoDto } from './dto/import-repo.dto';

const GITHUB_API = 'https://api.github.com';

const SKIP_DIR_SEGMENTS = [
  'node_modules', 'dist', 'build', '.git', '.next', '.nuxt',
  'coverage', '.cache', 'vendor', '.turbo', 'out',
];

const SKIP_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
  '.woff', '.woff2', '.ttf', '.eot', '.pdf', '.zip', '.map',
  '.lock', '.min.js', '.min.css',
];

const SKIP_FILENAMES = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];

// With Groq's free-tier pacing (see ai.service.ts) landing at roughly one
// batch request per ~60s, this cap keeps a typical import to a handful of
// batches. It's a real trade-off, not just an optimization: larger repos are
// truncated to this budget (prioritizing shallow/small files) rather than
// processed in full, so an import stays predictable instead of open-ended.
const MAX_FILES = 60;
const MAX_FILE_BYTES = 8_000;
const MAX_TOTAL_CHARS = 50_000;

const BATCH_CHAR_BUDGET = 14_000;
const BATCH_CONCURRENCY = 1; // must stay 1 — see ai.service.ts for why

interface GithubTreeEntry {
  path: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
}

export type ImportJobStatus = 'fetching' | 'analyzing' | 'saving' | 'done' | 'error';

export interface ImportJob {
  userId: string;
  status: ImportJobStatus;
  stageLabel: string;
  progress: number; // 0-100
  repoFullName?: string;
  totalBatches?: number;
  completedBatches?: number;
  result?: {
    project: { id: string; name: string; description: string | null; sourceRepo: string | null };
    filesAnalyzed: number;
    notesCreated: number;
    snippetsCreated: number;
  };
  error?: string;
  createdAt: number;
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

const JOB_RETENTION_MS = 15 * 60 * 1000; // keep a finished job's result around for 15 min so the frontend can still fetch it

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  // In-memory job store. Fine for a single-instance deployment (which this is);
  // if this ever runs on multiple instances, this would need to move to Redis/DB.
  private jobs = new Map<string, ImportJob>();
  // Prevents one user from having two imports running at once — without this,
  // concurrent imports interleave and both compete for the same shared Groq
  // rate-limit budget, making both take far longer than either would alone.
  private activeJobByUser = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  private async getGithubToken(userId: string): Promise<string> {
    const account = await this.prisma.oAuthAccount.findFirst({
      where: { userId, provider: 'github' },
    });
    if (!account?.accessToken) {
      throw new BadRequestException(
        'Connect your GitHub account first (Settings → Sign in with GitHub) before importing a repository.',
      );
    }
    return account.accessToken;
  }

  private async githubFetch(path: string, token: string, attempt = 1): Promise<any> {
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
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        return this.githubFetch(path, token, attempt + 1);
      }
      throw new InternalServerErrorException(
        `Could not reach GitHub after ${attempt} attempts: ${(err as Error).message}`,
      );
    }

    if (!res.ok) {
      if (res.status === 401) {
        throw new BadRequestException(
          'Your GitHub connection has expired or lacks the required permissions. Reconnect GitHub and try again.',
        );
      }
      if ((res.status === 429 || res.status >= 500) && attempt < 3) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        return this.githubFetch(path, token, attempt + 1);
      }
      const body = await res.text();
      this.logger.error(`GitHub API error ${res.status} for ${path}: ${body}`);
      throw new InternalServerErrorException(`GitHub API request failed (${res.status})`);
    }
    return res.json();
  }

  async listRepos(userId: string) {
    const token = await this.getGithubToken(userId);
    const repos = await this.githubFetch(
      '/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator',
      token,
    );
    return (repos as any[]).map((r) => ({
      owner: r.owner.login,
      name: r.name,
      fullName: r.full_name,
      description: r.description,
      private: r.private,
      defaultBranch: r.default_branch,
      updatedAt: r.updated_at,
      language: r.language,
    }));
  }

  private shouldSkipPath(path: string): boolean {
    const segments = path.split('/');
    if (segments.some((s) => SKIP_DIR_SEGMENTS.includes(s))) return true;
    const filename = segments[segments.length - 1];
    if (SKIP_FILENAMES.includes(filename)) return true;
    if (SKIP_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(ext))) return true;
    return false;
  }

  private async fetchFileContents(
    owner: string,
    repo: string,
    entries: GithubTreeEntry[],
    token: string,
  ): Promise<AnalyzedFile[]> {
    const limited = entries.slice(0, MAX_FILES);
    const fetched = await mapWithConcurrency(limited, 8, async (entry) => {
      const blob = await this.githubFetch(`/repos/${owner}/${repo}/git/blobs/${entry.sha}`, token);
      if (blob.encoding !== 'base64') return null;
      try {
        const content = Buffer.from(blob.content, 'base64').toString('utf-8');
        return { path: entry.path, content: content.slice(0, MAX_FILE_BYTES) } as AnalyzedFile;
      } catch {
        return null;
      }
    });

    const files: AnalyzedFile[] = [];
    let totalChars = 0;
    for (const file of fetched) {
      if (!file) continue;
      if (totalChars >= MAX_TOTAL_CHARS) break;
      files.push(file);
      totalChars += file.content.length;
    }
    return files;
  }

  /**
   * Starts an import as a background job and returns immediately with a job ID.
   * This is deliberately NOT one long-held HTTP request — a real import can take
   * several minutes (Groq's free-tier rate limit forces pacing between batches),
   * and browsers/proxies/load balancers commonly kill HTTP connections well
   * before that. The frontend polls getJobStatus() instead.
   */
  startImport(userId: string, dto: ImportRepoDto): { jobId: string } {
    const existingJobId = this.activeJobByUser.get(userId);
    if (existingJobId) {
      const existingJob = this.jobs.get(existingJobId);
      if (existingJob && existingJob.status !== 'done' && existingJob.status !== 'error') {
        throw new ConflictException(
          `You already have an import in progress (${existingJob.repoFullName ?? 'a repository'}). Wait for it to finish before starting another.`,
        );
      }
    }

    const jobId = randomUUID();
    const job: ImportJob = {
      userId,
      status: 'fetching',
      stageLabel: 'Connecting to GitHub…',
      progress: 0,
      createdAt: Date.now(),
    };
    this.jobs.set(jobId, job);
    this.activeJobByUser.set(userId, jobId);

    // Intentionally not awaited — this runs in the background while the
    // caller already has their jobId and can start polling.
    this.runImportJob(jobId, userId, dto).catch((err) => {
      this.logger.error(`Unhandled error in import job ${jobId}`, err as Error);
      const job = this.jobs.get(jobId);
      if (job) {
        job.status = 'error';
        job.error = err instanceof Error ? err.message : 'Import failed unexpectedly';
      }
    });

    return { jobId };
  }

  getJobStatus(userId: string, jobId: string): ImportJob {
    const job = this.jobs.get(jobId);
    // Ownership check — don't let one user poll another user's job by guessing an ID.
    if (!job || job.userId !== userId) {
      throw new NotFoundException('Import job not found');
    }
    return job;
  }

  private async runImportJob(jobId: string, userId: string, dto: ImportRepoDto): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    try {
      const token = await this.getGithubToken(userId);
      const { owner, repo } = dto;

      const repoInfo = await this.githubFetch(`/repos/${owner}/${repo}`, token);
      job.repoFullName = repoInfo.full_name;
      const branch = dto.branch || repoInfo.default_branch;

      job.stageLabel = 'Reading repository files…';
      job.progress = 8;

      const treeRes = await this.githubFetch(
        `/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
        token,
      );

      const candidateEntries: GithubTreeEntry[] = (treeRes.tree as GithubTreeEntry[]).filter(
        (e) =>
          e.type === 'blob' &&
          !this.shouldSkipPath(e.path) &&
          (e.size ?? 0) > 0 &&
          (e.size ?? 0) < 200_000,
      );

      if (candidateEntries.length === 0) {
        throw new BadRequestException(
          'No analyzable source files were found in this repository (after filtering out binaries, lockfiles, and build output).',
        );
      }

      candidateEntries.sort((a, b) => {
        const depthDiff = a.path.split('/').length - b.path.split('/').length;
        if (depthDiff !== 0) return depthDiff;
        return (a.size ?? 0) - (b.size ?? 0);
      });

      const files = await this.fetchFileContents(owner, repo, candidateEntries, token);
      job.progress = 15;

      job.status = 'analyzing';
      job.stageLabel = 'Analyzing with AI…';
      const analysis = await this.analyzeInBatches(jobId, repoInfo.full_name, files);

      job.status = 'saving';
      job.stageLabel = 'Creating notes and snippets…';
      job.progress = 92;

      const project = await this.prisma.project.create({
        data: {
          userId,
          name: repoInfo.name,
          description: repoInfo.description || `Imported from ${repoInfo.full_name}`,
          sourceRepo: repoInfo.full_name,
        },
      });

      if (analysis.notes.length > 0) {
        await this.prisma.note.createMany({
          data: analysis.notes.map((n) => ({
            userId,
            projectId: project.id,
            title: n.title,
            content: n.content,
            tags: n.tags ?? [],
          })),
        });
      }

      if (analysis.snippets.length > 0) {
        await this.prisma.snippet.createMany({
          data: analysis.snippets.map((s) => ({
            userId,
            projectId: project.id,
            title: s.title,
            description: s.description,
            code: s.code,
            language: s.language || 'plaintext',
            tags: s.tags ?? [],
          })),
        });
      }

      job.status = 'done';
      job.stageLabel = 'Done!';
      job.progress = 100;
      job.result = {
        project,
        filesAnalyzed: files.length,
        notesCreated: analysis.notes.length,
        snippetsCreated: analysis.snippets.length,
      };
    } catch (err) {
      job.status = 'error';
      job.error = err instanceof Error ? err.message : 'Import failed unexpectedly';
      this.logger.error(`Import job ${jobId} failed`, err as Error);
    } finally {
      if (this.activeJobByUser.get(userId) === jobId) {
        this.activeJobByUser.delete(userId);
      }
      setTimeout(() => this.jobs.delete(jobId), JOB_RETENTION_MS);
    }
  }

  private async analyzeInBatches(
    jobId: string,
    repoFullName: string,
    files: AnalyzedFile[],
  ): Promise<AiRepoAnalysis> {
    const batches = batchFiles(files, BATCH_CHAR_BUDGET);
    const job = this.jobs.get(jobId);
    if (job) {
      job.totalBatches = batches.length;
      job.completedBatches = 0;
    }
    this.logger.log(
      `Analyzing ${files.length} files across ${batches.length} batch(es) for ${repoFullName} (concurrency: ${BATCH_CONCURRENCY})`,
    );

    const combined: AiRepoAnalysis = { notes: [], snippets: [] };

    // Sequential on purpose — see ai.service.ts for why concurrency here is unsafe.
    for (let i = 0; i < batches.length; i++) {
      this.logger.log(`Batch ${i + 1}/${batches.length}: ${batches[i].length} files`);
      const result = await this.aiService.analyzeRepoFiles(repoFullName, batches[i]);
      combined.notes.push(...result.notes);
      combined.snippets.push(...result.snippets);

      if (job) {
        job.completedBatches = i + 1;
        // Analysis spans roughly 15%-90% of the overall progress bar.
        job.progress = 15 + Math.round(((i + 1) / batches.length) * 75);
        job.stageLabel = `Analyzing with AI… (batch ${i + 1} of ${batches.length})`;
      }
    }

    return combined;
  }
}
