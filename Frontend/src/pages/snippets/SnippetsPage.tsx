import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FiPlus, FiCode } from 'react-icons/fi';
import toast from 'react-hot-toast';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';
import SnippetCard from '@/components/snippets/SnippetCard';
import SnippetModal from '@/components/snippets/SnippetModal';
import SnippetPreviewModal from '@/components/snippets/SnippetPreviewModal';
import { snippetsService } from '@/services/snippetsService';
import { projectsService } from '@/services/projectsService';
import type { Snippet } from '@/types';

export default function SnippetsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [langFilter, setLangFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);
  const [previewingSnippet, setPreviewingSnippet] = useState<Snippet | null>(null);

  const { data: snippets, isLoading } = useQuery({
    queryKey: ['snippets'],
    queryFn: () => snippetsService.list(),
  });

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsService.list,
  });

  const languages = useMemo(() => {
    if (!snippets) return [];
    return [...new Set(snippets.map((s) => s.language))].sort();
  }, [snippets]);

  const filtered = useMemo(() => {
    if (!snippets) return [];
    let result = snippets;
    if (langFilter) result = result.filter((s) => s.language === langFilter);
    if (projectFilter) result = result.filter((s) => s.projectId === projectFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q)) ||
          (s.description ?? '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [snippets, search, langFilter, projectFilter]);

  async function handleCreate(input: Parameters<typeof snippetsService.create>[0]) {
    await snippetsService.create(input);
    queryClient.invalidateQueries({ queryKey: ['snippets'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    toast.success('Snippet saved');
  }

  async function handleUpdate(id: string, input: Parameters<typeof snippetsService.update>[1]) {
    await snippetsService.update(id, input);
    queryClient.invalidateQueries({ queryKey: ['snippets'] });
    toast.success('Snippet updated');
  }

  async function handleToggleFavorite(id: string) {
    await snippetsService.toggleFavorite(id);
    queryClient.invalidateQueries({ queryKey: ['snippets'] });
  }

  async function handleDelete(id: string) {
    await snippetsService.delete(id);
    queryClient.invalidateQueries({ queryKey: ['snippets'] });
    toast.success('Snippet deleted');
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-14 z-[5] bg-ink -mx-4 px-4 sm:-mx-6 sm:px-6 pt-2 pb-4 flex items-center justify-between gap-4 flex-wrap border-b border-border/50">
        <div>
          <h1 className="font-display text-2xl font-semibold">Snippets</h1>
          <p className="text-sm text-text-muted mt-1">
            Save and reuse code snippets across languages.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap w-full sm:w-auto">
          <input
            className="input w-full sm:w-48"
            placeholder="Search snippets…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {languages.length > 0 && (
            <select
              className="input w-full sm:w-36"
              value={langFilter}
              onChange={(e) => setLangFilter(e.target.value)}
            >
              <option value="">All languages</option>
              {languages.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          )}
          {projects && projects.length > 0 && (
            <select
              className="input w-full sm:w-40"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
            >
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          <button className="btn-primary w-full sm:w-auto justify-center" onClick={() => { setEditingSnippet(null); setShowModal(true); }}>
            <FiPlus size={15} /> New snippet
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FiCode size={20} />}
          title={search || langFilter ? 'No snippets match your filter' : 'No snippets yet'}
          description={
            search || langFilter
              ? 'Try a different search or clear your filter.'
              : 'Save reusable code snippets with syntax highlighting.'
          }
          action={
            !search && !langFilter && (
              <button className="btn-primary" onClick={() => setShowModal(true)}>
                <FiPlus size={15} /> New snippet
              </button>
            )
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((snippet) => (
            <SnippetCard
              key={snippet.id}
              snippet={snippet}
              onEdit={(s) => { setEditingSnippet(s); setShowModal(true); }}
              onToggleFavorite={handleToggleFavorite}
              onDelete={handleDelete}
              onPreview={setPreviewingSnippet}
            />
          ))}
        </div>
      )}

      {showModal && (
        <SnippetModal
          snippet={editingSnippet}
          onClose={() => { setShowModal(false); setEditingSnippet(null); }}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
        />
      )}
      {previewingSnippet && (
        <SnippetPreviewModal
          snippet={previewingSnippet}
          onClose={() => setPreviewingSnippet(null)}
          onEdit={(s) => {
            setPreviewingSnippet(null);
            setEditingSnippet(s);
            setShowModal(true);
          }}
          onToggleFavorite={handleToggleFavorite}
          onDelete={(id) => {
            setPreviewingSnippet(null);
            handleDelete(id);
          }}
        />
      )}
    </div>
  );
}
