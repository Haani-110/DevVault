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

// Directories we never want to send to the AI or even look inside.
const SKIP_DIR_SEGMENTS = [
  'node_modules', 'dist', 'build', '.git', '.next', '.nuxt',
  'coverage', '.cache', 'vendor', '.turbo', 'out',
];

// File extensions that are either binary or too noisy to be useful as notes/snippets.
const SKIP_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
  '.woff', '.woff2', '.ttf', '.eot', '.pdf', '.zip', '.map',
  '.lock', '.min.js', '.min.css',
];

const SKIP_FILENAMES = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];

// These bound how much we fetch from GitHub overall — set high so a full repo
// gets pulled rather than artificially truncated. The real per-request limit
// that matters (Groq's free-tier tokens-per-minute cap) is handled separately
// below via batching, not by dropping files here.
const MAX_FILES = 500;
const MAX_FILE_BYTES = 40_000; // still guard against one absurdly large single file
const MAX_TOTAL_CHARS = 2_000_000; // overall safety ceiling, not a practical limit for most repos

// Groq's free tier caps requests at 12,000 tokens/minute (input + system prompt +
// reserved output tokens all count). Each AI call's input is kept under this budget
// (~4 chars/token estimate, with headroom for the system prompt and reserved output).
const BATCH_CHAR_BUDGET = 24_000;
// Wait between batches so cumulative usage across calls doesn't exceed the
// per-minute cap — this is a *rolling* limit, so back-to-back small requests
// can still add up and get rejected without this pause.
const BATCH_DELAY_MS = 65_000;

interface GithubTreeEntry {
  path: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Splits files into batches, each kept under BATCH_CHAR_BUDGET total content chars. */
function batchFiles(files: AnalyzedFile[], charBudget: number): AnalyzedFile[][] {
  const batches: AnalyzedFile[][] = [];
  let current: AnalyzedFile[] = [];
  let currentChars = 0;

  for (const file of files) {
    // A single file bigger than the whole budget still gets its own solo batch
    // rather than being dropped.
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

  private async githubFetch(path: string, token: string) {
    const res = await fetch(`${GITHUB_API}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!res.ok) {
      if (res.status === 401) {
        throw new BadRequestException(
          'Your GitHub connection has expired or lacks the required permissions. Reconnect GitHub and try again.',
        );
      }
      const body = await res.text();
      this.logger.error(`GitHub API error ${res.status} for ${path}: ${body}`);
      throw new InternalServerErrorException(`GitHub API request failed (${res.status})`);
    }
    return res.json();
  }

  /** List repos the user can import from, most recently updated first. */
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
        continue; // not valid utf-8 text — skip (likely binary we didn't catch by extension)
      }

      // Guard against giant single files blowing the whole budget.
      const truncated = content.slice(0, MAX_FILE_BYTES);
      totalChars += truncated.length;
      files.push({ path: entry.path, content: truncated });
    }

    return files;
  }

  /**
   * Runs AI analysis across all files in batches sized to fit Groq's free-tier
   * per-minute token budget, pausing between calls, and merges every batch's
   * notes/snippets into one combined result. No files are skipped because of
   * the AI provider's rate limit — they're just spread across multiple calls.
   */
  private async analyzeInBatches(
    repoFullName: string,
    files: AnalyzedFile[],
  ): Promise<AiRepoAnalysis> {
    const batches = batchFiles(files, BATCH_CHAR_BUDGET);
    const combined: AiRepoAnalysis = { notes: [], snippets: [] };

    for (let i = 0; i < batches.length; i++) {
      if (i > 0) {
        this.logger.log(
          `Waiting ${BATCH_DELAY_MS}ms before AI batch ${i + 1}/${batches.length} to respect rate limits`,
        );
        await sleep(BATCH_DELAY_MS);
      }
      this.logger.log(
        `Analyzing batch ${i + 1}/${batches.length} (${batches[i].length} files) for ${repoFullName}`,
      );
      const result = await this.aiService.analyzeRepoFiles(repoFullName, batches[i]);
      combined.notes.push(...result.notes);
      combined.snippets.push(...result.snippets);
    }

    return combined;
  }

  /** Fetch a repo's tree, pull a bounded set of file contents, run AI analysis, and persist the result. */
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
        (e.size ?? 0) < 200_000, // hard skip anything absurdly large before even fetching it
    );

    if (candidateEntries.length === 0) {
      throw new BadRequestException(
        'No analyzable source files were found in this repository (after filtering out binaries, lockfiles, and build output).',
      );
    }

    // Prioritize shallower, smaller files first — these tend to be more information-dense
    // (config, entry points, core modules) than deeply nested or huge generated files.
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
