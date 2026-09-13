import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FiCheck, FiGithub, FiLock, FiSearch } from 'react-icons/fi';
import ModalShell from '@/components/ui/ModalShell';
import ErrorState from '@/components/ui/ErrorState';
import { useGithubImport } from '@/hooks/useGithubImport';
import { apiErrorMessage, toApiError } from '@/lib/api-error';
import { authService } from '@/services/authService';
import {
  importService,
  isTerminal,
  type GithubRepo,
  type ImportStage,
} from '@/services/importService';

interface Props {
  onClose: () => void;
}

/** The stages the progress panel ticks off, in the order the backend runs them. */
const STAGES: { stage: ImportStage; label: string }[] = [
  { stage: 'READING', label: 'Reading the file list' },
  { stage: 'ANALYZING', label: 'Analyzing source with the model' },
  { stage: 'SAVING', label: 'Saving notes, snippets and tasks' },
];

const STAGE_ORDER: ImportStage[] = [
  'QUEUED',
  'CONNECTED',
  'READING',
  'ANALYZING',
  'SAVING',
  'COMPLETED',
];

export default function ImportGithubModal({ onClose }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<GithubRepo | null>(null);
  const [handled, setHandled] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const {
    data: repos,
    isLoading,
    isError,
    error: reposError,
    refetch,
  } = useQuery({
    queryKey: ['github-repos'],
    queryFn: importService.listGithubRepos,
    retry: false,
  });

  // The job lives in a hook rather than in this component so that reopening the
  // dialog (or reloading the page) picks up an import that is already running.
  const { job, starting, error, start, reset } = useGithubImport();

  const running = !!job && !isTerminal(job);
  const failed = job?.status === 'FAILED' ? job : null;
  const done = job?.status === 'COMPLETED' ? job : null;

  useEffect(() => {
    if (!done || handled) return;
    setHandled(true);

    for (const key of ['projects', 'notes', 'snippets', 'tasks', 'dashboard']) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }

    // A warning means something was skipped, and a silent jump to the project
    // page would hide that. Otherwise a short pause, then go look at the result.
    if (done.warning) return;

    const timer = setTimeout(() => {
      onClose();
      navigate(`/projects/${done.result!.project.id}`);
    }, 900);
    return () => clearTimeout(timer);
  }, [done, handled, queryClient, navigate, onClose]);

  const filteredRepos = useMemo(() => {
    if (!repos) return [];
    const q = search.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter(
      (r) => r.fullName.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q)
    );
  }, [repos, search]);

  // The API tells us this with GITHUB_NOT_CONNECTED; matching on the prose used
  // to mean a reworded message silently turned the connect panel into an error.
  const reposFailure = isError ? toApiError(reposError, 'Could not load your repositories.') : null;
  const needsGithubConnection = reposFailure?.code === 'GITHUB_NOT_CONNECTED';

  async function handleConnectGithub() {
    setConnecting(true);
    try {
      const { url } = await authService.getGithubLinkUrl();
      window.location.href = url;
    } catch (err: unknown) {
      toast.error(
        apiErrorMessage(err, 'Could not start the GitHub connection — please try again.')
      );
      setConnecting(false);
    }
  }

  function handleImport(repo: GithubRepo | null) {
    if (!repo) return;
    setHandled(false);
    void start(repo.owner, repo.name, repo.defaultBranch);
  }

  const progress = done ? 100 : (job?.progress ?? 0);
  const stageIndex = job ? STAGE_ORDER.indexOf(job.stage) : -1;

  return (
    <ModalShell
      title="Import from GitHub"
      icon={<FiGithub size={17} />}
      onClose={onClose}
      dismissable={!running}
    >
      {running || (done && !done.warning) ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 py-14 px-8 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center border-2 border-brass-400/30">
            {done ? (
              <FiCheck size={26} className="text-ok" />
            ) : (
              <span className="text-sm font-mono font-semibold text-brass-400">
                {Math.round(progress)}%
              </span>
            )}
          </div>

          <div className="w-full max-w-xs">
            <div
              className="h-1.5 w-full rounded-full bg-surface-raised overflow-hidden"
              role="progressbar"
              aria-valuenow={Math.round(progress)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Import progress"
            >
              <div
                className="h-full rounded-full bg-brass-400 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <ul className="space-y-1.5 text-left w-full max-w-xs">
            {STAGES.map(({ stage, label }) => {
              const index = STAGE_ORDER.indexOf(stage);
              const complete = !!done || (stageIndex > index && running);
              const active = !done && stageIndex === index;
              return (
                <li key={stage} className="flex items-center gap-2 text-xs">
                  <span
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      complete
                        ? 'bg-ok/15 border-ok/40 text-ok'
                        : active
                          ? 'border-brass-400 text-brass-400'
                          : 'border-border text-text-faint'
                    }`}
                  >
                    {complete ? (
                      <FiCheck size={10} />
                    ) : active ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-brass-400 animate-pulse" />
                    ) : null}
                  </span>
                  <span className={complete || active ? 'text-text' : 'text-text-faint'}>
                    {label}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="text-xs text-text-faint font-mono space-y-0.5">
            {job?.totalFiles ? (
              <p>
                {job.processedFiles} / {job.totalFiles} files
              </p>
            ) : null}
            {job?.totalBatches && job.totalBatches > 1 ? (
              <p>
                batch {job.completedBatches} of {job.totalBatches}
              </p>
            ) : null}
            {job?.currentFile ? <p className="truncate max-w-[16rem]">{job.currentFile}</p> : null}
          </div>

          <p className="text-xs text-text-faint max-w-xs">
            {done
              ? `Taking you to ${done.repoFullName}…`
              : `${job?.stageLabel ?? 'Queued'} — larger repositories take a few minutes, because the free AI tier has to be paced.`}
          </p>
        </div>
      ) : done ? (
        <div className="flex-1 px-6 py-8 text-center">
          <p className="text-sm text-text font-medium">Imported {done.repoFullName}</p>
          <p className="text-xs text-text-muted mt-1.5">
            {done.result
              ? `${done.result.notesCreated} notes · ${done.result.snippetsCreated} snippets · ${done.result.tasksCreated} tasks from ${done.result.filesAnalyzed} files`
              : ''}
          </p>
          {done.warning && (
            <p className="text-xs text-amber-400 mt-3 bg-amber-500/10 border border-amber-500/20 rounded px-3 py-2 text-left">
              {done.warning}
            </p>
          )}
          <div className="mt-5 flex items-center justify-center gap-2">
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                onClose();
                navigate(`/projects/${done.result!.project.id}`);
              }}
            >
              View project
            </button>
            <button type="button" className="btn-ghost" onClick={onClose}>
              Stay here
            </button>
          </div>
        </div>
      ) : needsGithubConnection ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
          <FiGithub size={28} className="text-text-faint" />
          <p className="text-sm text-text font-medium">Connect GitHub to import a repository</p>
          <p className="text-xs text-text-faint max-w-xs">
            DevVault reads your repositories using the same GitHub connection used for sign-in.
          </p>
          <button
            type="button"
            onClick={handleConnectGithub}
            disabled={connecting}
            className="btn-primary mt-2"
          >
            <FiGithub size={15} /> {connecting ? 'Redirecting…' : 'Connect GitHub'}
          </button>
        </div>
      ) : (
        <>
          <div className="px-5 pt-4 pb-3 shrink-0">
            <div className="relative">
              <FiSearch
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint"
                size={14}
              />
              <input
                className="input pl-8"
                placeholder="Search your repositories…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search repositories"
                autoFocus
              />
            </div>
          </div>

          {isError && (
            <div className="px-5 pb-3 shrink-0">
              <ErrorState
                error={reposFailure ?? 'Could not load your repositories.'}
                action="Repositories"
                onRetry={() => void refetch()}
                retryLabel="Reload"
              >
                <Link
                  className="text-xs text-brass-400 hover:underline"
                  to="/settings"
                  onClick={onClose}
                >
                  Check GitHub connection
                </Link>
              </ErrorState>
            </div>
          )}

          {failed && (
            <div className="px-5 pb-3 shrink-0">
              <ErrorState
                error={failed.error ?? 'The import stopped unexpectedly.'}
                action="Import failed"
                onRetry={() => {
                  reset();
                  void handleImport(selected);
                }}
                retryLabel={selected ? `Retry ${selected.fullName}` : 'Try again'}
              />
            </div>
          )}

          {error && !failed && (
            <div className="px-5 pb-3 shrink-0">
              <ErrorState
                error={error}
                action="The import could not be started"
                onRetry={reset}
                retryLabel="Back to the list"
              />
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1 min-h-0">
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 rounded bg-surface-raised/60 animate-pulse mx-2" />
              ))}

            {!isLoading && filteredRepos.length === 0 && (
              <p className="text-sm text-text-faint text-center py-8">
                {search.trim()
                  ? `No repositories match "${search}".`
                  : 'No repositories to import.'}
              </p>
            )}

            {filteredRepos.map((r) => (
              <button
                key={r.fullName}
                type="button"
                onClick={() => setSelected(r)}
                onDoubleClick={() => handleImport(r)}
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

          <div className="flex items-center justify-between px-5 py-4 border-t border-border shrink-0 gap-3">
            <p className="text-xs text-text-faint truncate">
              {selected ? `Selected: ${selected.fullName}` : 'Pick a repository to import'}
            </p>
            <button
              className="btn-primary"
              disabled={!selected || starting}
              onClick={() => handleImport(selected)}
            >
              {starting ? 'Starting…' : 'Import'}
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}
