import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FiX, FiGithub, FiSearch, FiLock, FiCheck } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { importService, type GithubRepo } from '@/services/importService';
import { authService } from '@/services/authService';

interface Props {
  onClose: () => void;
}

const STAGES = [
  { threshold: 0, label: 'Connecting to GitHub…' },
  { threshold: 12, label: 'Reading repository files…' },
  { threshold: 35, label: 'Analyzing with AI…' },
  { threshold: 90, label: 'Creating notes and snippets…' },
];

/**
 * Simulates a smooth, ever-advancing progress percentage while the single
 * import request is in flight. There's no real-time backend progress feed
 * (the whole import is one request/response), so this approximates it with
 * a time-based easing curve that reaches ~95% asymptotically — fast repos
 * feel fast, slow ones still show continuous forward motion rather than a
 * bare spinner, and it never falsely claims 100% until the request actually
 * resolves.
 */
function useSimulatedProgress(active: boolean, timeConstantSeconds = 70) {
  const [progress, setProgress] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      setProgress(0);
      startRef.current = null;
      return;
    }
    startRef.current = Date.now();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - (startRef.current ?? Date.now())) / 1000;
      const next = 95 * (1 - Math.exp(-elapsed / timeConstantSeconds));
      setProgress(next);
    }, 250);
    return () => clearInterval(interval);
  }, [active, timeConstantSeconds]);

  const stage = [...STAGES].reverse().find((s) => progress >= s.threshold) ?? STAGES[0];
  return { progress, stageLabel: stage.label };
}

export default function ImportGithubModal({ onClose }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<GithubRepo | null>(null);
  const [justFinished, setJustFinished] = useState(false);

  const { data: repos, isLoading, isError, error } = useQuery({
    queryKey: ['github-repos'],
    queryFn: importService.listGithubRepos,
    retry: false,
  });

  const importMutation = useMutation({
    mutationFn: () => importService.importGithubRepo(selected!.owner, selected!.name, selected!.defaultBranch),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      // Brief 100% + checkmark flash so the bar doesn't jump straight from
      // ~90% to the modal vanishing — a small but real confirmation moment.
      setJustFinished(true);
      setTimeout(() => {
        toast.success(
          `Imported ${result.notesCreated} notes and ${result.snippetsCreated} snippets from ${selected!.fullName}`,
        );
        onClose();
        navigate(`/projects/${result.project.id}`);
      }, 500);
    },
    onError: (err: unknown) => {
      const message =
        (err as any)?.response?.data?.message || 'Import failed — please try again.';
      toast.error(Array.isArray(message) ? message[0] : message);
    },
  });

  const { progress, stageLabel } = useSimulatedProgress(importMutation.isPending);

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && !importMutation.isPending && onClose()}
    >
      <div className="card w-full max-w-lg flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <FiGithub size={17} />
            <h2 className="font-display font-semibold text-lg">Import from GitHub</h2>
          </div>
          {!importMutation.isPending && (
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
              aria-label="Close"
            >
              <FiX size={16} />
            </button>
          )}
        </div>

        {importMutation.isPending ? (
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
                  className="h-full rounded-full bg-brass-400 transition-all duration-300 ease-out"
                  style={{ width: `${justFinished ? 100 : progress}%` }}
                />
              </div>
            </div>

            <div>
              <p className="text-sm text-text font-medium">
                {justFinished ? 'Done!' : stageLabel}
              </p>
              <p className="text-xs text-text-faint mt-1 max-w-xs">
                {justFinished
                  ? `Taking you to ${selected?.fullName}…`
                  : `Analyzing ${selected?.fullName} — larger repos can take a few minutes.`}
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
                disabled={!selected}
                onClick={() => importMutation.mutate()}
              >
                Import
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
