import { api } from '@/lib/axios';

export interface GithubRepo {
  owner: string;
  name: string;
  fullName: string;
  description: string | null;
  private: boolean;
  defaultBranch: string;
  updatedAt: string;
  language: string | null;
}

export interface ImportResult {
  project: { id: string; name: string; description: string | null; sourceRepo: string | null };
  filesAnalyzed: number;
  notesCreated: number;
  snippetsCreated: number;
}

export type ImportJobStatus = 'fetching' | 'analyzing' | 'saving' | 'done' | 'error';

export interface ImportJobState {
  status: ImportJobStatus;
  stageLabel: string;
  progress: number;
  repoFullName?: string;
  totalBatches?: number;
  completedBatches?: number;
  result?: ImportResult;
  error?: string;
}

export const importService = {
  async listGithubRepos(): Promise<GithubRepo[]> {
    const { data } = await api.get('/import/github/repos');
    return data;
  },

  /**
   * Starts an import in the background and returns immediately with a jobId.
   * A real import can take a few minutes (AI rate-limit pacing), so this is
   * intentionally not one long-held request — poll getImportStatus() instead.
   */
  async startImport(owner: string, repo: string, branch?: string): Promise<{ jobId: string }> {
    const { data } = await api.post('/import/github', { owner, repo, branch });
    return data;
  },

  async getImportStatus(jobId: string): Promise<ImportJobState> {
    const { data } = await api.get(`/import/github/status/${jobId}`);
    return data;
  },
};
