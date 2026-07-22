import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FiX, FiGithub, FiSearch, FiLock, FiCheck } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { importService, type GithubRepo } from '@/services/importService';
import { authService } from '@/services/authService';

interface Props {
  onClose: () => void;
}

export default function ImportGithubModal({ onClose }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<GithubRepo | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [handledResult, setHandledResult] = useState(false);

  const { data: repos, isLoading, isError, error } = useQuery({
    queryKey: ['github-repos'],
    queryFn: importService.listGithubRepos,
    retry: false,
  });

  const startMutation = useMutation({
    mutationFn: () => importService.startImport(selected!.owner, selected!.name, selected!.defaultBranch),
    onSuccess: ({ jobId }) => {
      setJobId(jobId);
      setHandledResult(false);
    },
    onError: (err: unknown) => {
      const message =
        (err as any)?.response?.data?.message || 'Could not start the import — please try again.';
      toast.error(Array.isArray(message) ? message[0] : message);
    },
  });

  // Polls the actual backend job — a real import can take a few minutes
  // (AI rate-limit pacing forces this), so it's a background job rather than
  // one long-held request. This shows genuine progress, not a simulation.
  const { data: job } = useQuery({
    queryKey: ['import-job', jobId],
    queryFn: () => importService.getImportStatus(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'done' || status === 'error' ? false : 2000;
    },
  });

  // React to the job reaching a terminal state (done/error) exactly once,
  // via an effect — not during render, since this triggers navigation/toasts.
  useEffect(() => {
    if (job?.status === 'done' && job.result && !handledResult) {
      setHandledResult(true);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      const result = job.result;
      const repoName = job.repoFullName ?? selected?.fullName;
      const timer = setTimeout(() => {
        toast.success(`Imported ${result.notesCreated} notes and ${result.snippetsCreated} snippets from ${repoName}`);
        onClose();
        navigate(`/projects/${result.project.id}`);
      }, 500);
      return () => clearTimeout(timer);
    }
    if (job?.status === 'error' && !handledResult) {
      setHandledResult(true);
      toast.error(job.error || 'Import failed — please try again.');
      setJobId(null);
    }
  }, [job, handledResult, queryClient, navigate, onClose, selected]);

  const isActivelyRunning = !!jobId && (!job || (job.status !== 'done' && job.status !== 'error'));
  const justFinished = job?.status === 'done';

  const filteredRepos = useMemo(() => {
    if (!repos) return [];
    if (!search.trim()) return repos;
    const q = search.toLowerCase();
    return repos.filter(
      (r) => r.fullName.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q),
    );
  }, [repos, search]);

  const needsGithubConnection =
    isError && (error as any)?.response?.data?.message?.includes('Connect your GitHub account');

  const [connecting, setConnecting] = useState(false);
  const handleConnectGithub = async () => {
    setConnecting(true);
    try {
      const { url } = await authService.getGithubLinkUrl();
      window.location.href = url;
    } catch {
      toast.error('Could not start the GitHub connection — please try again.');
      setConnecting(false);
    }
  };

  const showProgress = isActivelyRunning || justFinished;
  const progress = justFinished ? 100 : job?.progress ?? 0;
  const stageLabel = justFinished ? 'Done!' : job?.stageLabel ?? 'Starting…';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && !isActivelyRunning && onClose()}
    >
      <div className="card w-full max-w-lg flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <FiGithub size={17} />
            <h2 className="font-display font-semibold text-lg">Import from GitHub</h2>
          </div>
          {!isActivelyRunning && (
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
              aria-label="Close"
            >
              <FiX size={16} />
            </button>
          )}
        </div>

        {showProgress ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-16 px-8 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center border-2 border-brass-400/30">
              {justFinished ? (
                <FiCheck size={26} className="text-ok" />
              ) : (
                <span className="text-sm font-mono font-semibold text-brass-400">
                  {Math.round(progress)}%
                </span>
              )}
            </div>

            <div className="w-full max-w-xs">
              <div className="h-1.5 w-full rounded-full bg-surface-raised overflow-hidden">
                <div
                  className="h-full rounded-full bg-brass-400 transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {job?.totalBatches && job.totalBatches > 1 && !justFinished && (
                <p className="text-[11px] text-text-faint mt-1.5 font-mono">
                  Batch {job.completedBatches ?? 0} of {job.totalBatches}
                </p>
              )}
            </div>

            <div>
              <p className="text-sm text-text font-medium">{stageLabel}</p>
              <p className="text-xs text-text-faint mt-1 max-w-xs">
                {justFinished
                  ? `Taking you to ${job?.repoFullName ?? selected?.fullName}…`
                  : `Analyzing ${job?.repoFullName ?? selected?.fullName} — larger repos can take a few minutes due to the free-tier AI rate limit.`}
              </p>
            </div>
          </div>
        ) : needsGithubConnection ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
            <FiGithub size={28} className="text-text-faint" />
            <p className="text-sm text-text font-medium">Connect GitHub to import a repository</p>
            <p className="text-xs text-text-faint max-w-xs">
              DevVault reads your repositories using the same GitHub connection
              used for sign-in.
            </p>
            <button onClick={handleConnectGithub} disabled={connecting} className="btn-primary mt-2">
              <FiGithub size={15} /> {connecting ? 'Redirecting…' : 'Connect GitHub'}
            </button>
          </div>
        ) : (
          <>
            <div className="px-5 pt-4 pb-3">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" size={14} />
                <input
                  className="input pl-8"
                  placeholder="Search your repositories…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
              {isLoading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-14 rounded bg-surface-raised/60 animate-pulse mx-2" />
                ))}

              {!isLoading && filteredRepos.length === 0 && (
                <p className="text-sm text-text-faint text-center py-8">
                  No repositories match "{search}".
                </p>
              )}

              {filteredRepos.map((r) => (
                <button
                  key={r.fullName}
                  onClick={() => setSelected(r)}
                  className={`w-full text-left px-3 py-2.5 rounded transition-colors ${
                    selected?.fullName === r.fullName
                      ? 'bg-brass-400/10 border border-brass-400/40'
                      : 'border border-transparent hover:bg-surface-hover'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-text truncate">{r.fullName}</span>
                    {r.private && <FiLock size={11} className="text-text-faint shrink-0" />}
                  </div>
                  {r.description && (
                    <p className="text-xs text-text-faint truncate mt-0.5">{r.description}</p>
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between px-5 py-4 border-t border-border">
              <p className="text-xs text-text-faint">
                {selected ? `Selected: ${selected.fullName}` : 'Pick a repository to import'}
              </p>
              <button
                className="btn-primary"
                disabled={!selected || startMutation.isPending}
                onClick={() => startMutation.mutate()}
              >
                {startMutation.isPending ? 'Starting…' : 'Import'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
