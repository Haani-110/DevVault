import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
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

const MAX_FILES = 500;
const MAX_FILE_BYTES = 40_000;
const MAX_TOTAL_CHARS = 2_000_000;

const BATCH_CHAR_BUDGET = 24_000;
// How many batches to send to Groq at once. Groq's inference is fast (typically
// a few seconds per call even for large batches), so a handful in parallel keeps
// total wall-clock time for a big repo well within a few minutes, rather than
// the minutes-per-batch cost of doing them one after another.
const BATCH_CONCURRENCY = 5;

interface GithubTreeEntry {
  path: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
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

/**
 * Runs `items` through `worker` with at most `concurrency` running at once.
 * Batches are analyzed in parallel (rather than one at a time) so a repo that
 * splits into many batches still finishes in a bounded amount of wall-clock
 * time — sequential processing of, say, 20+ batches could otherwise blow well
 * past a "few minutes" import target even though each individual call is fast.
 */
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

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

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
      // Network-level failure (DNS blip, connection reset) — retry a couple times.
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
      // Retry on rate-limit/server errors only — a 404/400 won't fix itself by retrying.
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
    const files: AnalyzedFile[] = [];
    let totalChars = 0;

    for (const entry of entries) {
      if (files.length >= MAX_FILES || totalChars >= MAX_TOTAL_CHARS) break;

      const blob = await this.githubFetch(
        `/repos/${owner}/${repo}/git/blobs/${entry.sha}`,
        token,
      );
      if (blob.encoding !== 'base64') continue;

      let content: string;
      try {
        content = Buffer.from(blob.content, 'base64').toString('utf-8');
      } catch {
        continue;
      }

      const truncated = content.slice(0, MAX_FILE_BYTES);
      totalChars += truncated.length;
      files.push({ path: entry.path, content: truncated });
    }

    return files;
  }

  private async analyzeInBatches(
    repoFullName: string,
    files: AnalyzedFile[],
  ): Promise<AiRepoAnalysis> {
    const batches = batchFiles(files, BATCH_CHAR_BUDGET);
    this.logger.log(
      `Analyzing ${files.length} files across ${batches.length} batch(es) for ${repoFullName} (concurrency: ${BATCH_CONCURRENCY})`,
    );

    const results = await mapWithConcurrency(batches, BATCH_CONCURRENCY, async (batch, i) => {
      this.logger.log(`Batch ${i + 1}/${batches.length}: ${batch.length} files`);
      return this.aiService.analyzeRepoFiles(repoFullName, batch);
    });

    const combined: AiRepoAnalysis = { notes: [], snippets: [] };
    for (const result of results) {
      combined.notes.push(...result.notes);
      combined.snippets.push(...result.snippets);
    }
    return combined;
  }

  async importRepo(userId: string, dto: ImportRepoDto) {
    const token = await this.getGithubToken(userId);
    const { owner, repo } = dto;

    const repoInfo = await this.githubFetch(`/repos/${owner}/${repo}`, token);
    const branch = dto.branch || repoInfo.default_branch;

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

    const analysis = await this.analyzeInBatches(repoInfo.full_name, files);

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

    return {
      project,
      filesAnalyzed: files.length,
      notesCreated: analysis.notes.length,
      snippetsCreated: analysis.snippets.length,
    };
  }
}
