import { api } from '@/lib/axios';

/**
 * Client for the background GitHub import.
 *
 * An import is a *job*, not a request: `POST /import/github` validates the
 * repository, stores a row and answers with a `jobId` straight away, then the
 * worker walks the repo, asks the model about it in batches and writes the
 * results. Polling `getJob` is what lets the UI survive a reload, a navigation
 * or a five-minute run — none of which a single long HTTP request would.
 */

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

export type ImportJobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

/** Coarse pipeline stages, mirrored from the Prisma `ImportStage` enum. */
export type ImportStage =
  | 'QUEUED'
  | 'CONNECTED'
  | 'READING'
  | 'ANALYZING'
  | 'SAVING'
  | 'COMPLETED'
  | 'FAILED';

export interface ImportJobResult {
  project: { id: string; name: string; description: string | null; sourceRepo: string | null };
  filesAnalyzed: number;
  notesCreated: number;
  snippetsCreated: number;
  tasksCreated: number;
}

export interface ImportJob {
  jobId: string;
  status: ImportJobStatus;
  stage: ImportStage;
  stageLabel: string;
  /** 0-100. A pacing hint for the bar, not a promise about remaining time. */
  progress: number;
  repoFullName: string;
  branch: string | null;
  totalFiles: number;
  processedFiles: number;
  currentFile: string | null;
  totalBatches: number;
  completedBatches: number;
  /** Present only once the job has completed. */
  result: ImportJobResult | null;
  /** Partial success: some files were skipped, or a batch failed. */
  warning: string | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export const importService = {
  async listGithubRepos(): Promise<GithubRepo[]> {
    const { data } = await api.get('/import/github/repos');
    return data;
  },

  async startImport(owner: string, repo: string, branch?: string): Promise<{ jobId: string }> {
    const { data } = await api.post('/import/github', { owner, repo, branch });
    return data;
  },

  async getJob(jobId: string): Promise<ImportJob> {
    const { data } = await api.get(`/import/github/jobs/${jobId}`);
    return data;
  },

  /**
   * The most recent job for this user, or null. Called when the import dialog
   * opens: if a job is still running, the honest thing to show is that one —
   * starting a second would only be refused with a 409.
   */
  async getLatestJob(): Promise<ImportJob | null> {
    const { data } = await api.get<{ job: ImportJob | null }>('/import/github/jobs/latest');
    return data.job ?? null;
  },
};

export const isTerminal = (job: ImportJob | undefined): boolean =>
  job?.status === 'COMPLETED' || job?.status === 'FAILED';
