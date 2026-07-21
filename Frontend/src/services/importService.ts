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
  project: { id: string; name: string; description: string | null; sourceRepo: string };
  filesAnalyzed: number;
  notesCreated: number;
  snippetsCreated: number;
}

export const importService = {
  async listGithubRepos(): Promise<GithubRepo[]> {
    const { data } = await api.get('/import/github/repos');
    return data;
  },

  async importGithubRepo(owner: string, repo: string, branch?: string): Promise<ImportResult> {
    const { data } = await api.post('/import/github', { owner, repo, branch });
    return data;
  },
};
