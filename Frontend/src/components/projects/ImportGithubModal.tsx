import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FiX, FiGithub, FiSearch, FiLock, FiLoader } from 'react-icons/fi';
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
      toast.success(
        `Imported ${result.notesCreated} notes and ${result.snippetsCreated} snippets from ${selected!.fullName}`,
      );
      onClose();
      navigate(`/projects/${result.project.id}`);
    },
    onError: (err: unknown) => {
      const message =
        (err as any)?.response?.data?.message || 'Import failed — please try again.';
      toast.error(Array.isArray(message) ? message[0] : message);
    },
  });

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
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
            <FiLoader size={28} className="animate-spin text-brass-400" />
            <p className="text-sm text-text font-medium">
              Analyzing {selected?.fullName}…
            </p>
            <p className="text-xs text-text-faint max-w-xs">
              Reading source files and generating notes and snippets. This can take
              10–30 seconds depending on the repo's size.
            </p>
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
