import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService, AnalyzedFile } from '../ai/ai.service';
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

const MAX_FILES = 30;
const MAX_FILE_BYTES = 40_000; // skip unusually large single files
const MAX_TOTAL_CHARS = 60_000; // cap total content sent to the AI per import

interface GithubTreeEntry {
  path: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
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

    const analysis = await this.aiService.analyzeRepoFiles(repoInfo.full_name, files);

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
