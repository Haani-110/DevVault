import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FiPlus, FiFileText, FiArchive } from 'react-icons/fi';
import toast from 'react-hot-toast';
import NoteCard from '@/components/notes/NoteCard';
import NewNoteModal from '@/components/notes/NewNoteModal';
import EditNoteModal from '@/components/notes/EditNoteModal';
import NotePreviewModal from '@/components/notes/NotePreviewModal';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import Skeleton from '@/components/ui/Skeleton';
import { notesService } from '@/services/notesService';
import { apiErrorMessage } from '@/lib/api-error';
import { projectsService } from '@/services/projectsService';
import type { Note } from '@/types';

type FilterTab = 'all' | 'pinned' | 'favorites' | 'archived';

export default function NotesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [previewingNote, setPreviewingNote] = useState<Note | null>(null);
  const [projectFilter, setProjectFilter] = useState('');

  // Active and archived notes are two queries, because the API returns one half
  // or the other. The Archived tab used to filter a list that could never
  // contain an archived note — which is why it looked empty rather than wrong.
  const showArchived = activeTab === 'archived';

  const activeQuery = useQuery({
    queryKey: ['notes', { archived: false }],
    queryFn: () => notesService.list(undefined, false),
  });
  const archivedQuery = useQuery({
    queryKey: ['notes', { archived: true }],
    queryFn: () => notesService.list(undefined, true),
  });

  const notes = showArchived ? archivedQuery.data : activeQuery.data;
  const isLoading = showArchived ? archivedQuery.isLoading : activeQuery.isLoading;
  const queryError = showArchived ? archivedQuery.error : activeQuery.error;
  const queryFailed = showArchived ? archivedQuery.isError : activeQuery.isError;
  const retryQuery = () => void (showArchived ? archivedQuery.refetch() : activeQuery.refetch());

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsService.list,
  });

  const filtered = useMemo(() => {
    if (!notes) return [];
    let result = notes;

    if (!showArchived) {
      if (activeTab === 'pinned') result = result.filter((n) => n.isPinned);
      if (activeTab === 'favorites') result = result.filter((n) => n.isFavorite);
    }

    if (projectFilter) {
      result = result.filter((n) => n.projectId === projectFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q)) ||
          n.content.toLowerCase().includes(q)
      );
    }
    return result;
  }, [notes, search, activeTab, projectFilter, showArchived]);

  const archivedCount = useMemo(() => archivedQuery.data?.length ?? 0, [archivedQuery.data]);
  const activeNotes = useMemo(() => activeQuery.data ?? [], [activeQuery.data]);

  /**
   * Every write goes through here: refresh the cache on success, and say so when
   * it failed. Without the catch, a rejected request was a silent no-op — the
   * card would flip back on the next render and nothing explained why.
   */
  async function mutate(action: () => Promise<unknown>, success?: string) {
    try {
      await action();
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      if (success) toast.success(success);
      return true;
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, 'That did not save — please try again.'));
      return false;
    }
  }

  const handleTogglePin = (id: string) => mutate(() => notesService.togglePin(id));
  const handleToggleFavorite = (id: string) => mutate(() => notesService.toggleFavorite(id));
  const handleToggleArchive = (id: string, currentlyArchived: boolean) =>
    mutate(() => notesService.toggleArchive(id), currentlyArchived ? 'Note restored' : 'Note archived');
  const handleDelete = (id: string) => mutate(() => notesService.delete(id), 'Note deleted');
  const handleCreate = (input: { title: string; content: string; tags: string[] }) =>
    mutate(() => notesService.create(input), 'Note saved');
  const handleEdit = (id: string, data: { title: string; content: string; tags: string[] }) =>
    mutate(() => notesService.update(id, data), 'Note updated');

  const tabs: { id: FilterTab; label: string; count?: number }[] = [
    { id: 'all', label: 'All', count: activeNotes.length },
    { id: 'pinned', label: 'Pinned', count: activeNotes.filter((n) => n.isPinned).length },
    { id: 'favorites', label: 'Favorites', count: activeNotes.filter((n) => n.isFavorite).length },
    { id: 'archived', label: 'Archived', count: archivedCount },
  ];

  return (
    <div className="space-y-6">
      <div className="sticky top-14 z-[5] bg-ink -mx-4 px-4 sm:-mx-6 sm:px-6 pt-2 pb-4 flex items-center justify-between gap-4 flex-wrap border-b border-border/50">
        <div>
          <h1 className="font-display text-2xl font-semibold">Notes</h1>
          <p className="text-sm text-text-muted mt-1">
            Markdown notes with tags, pinning and search.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap w-full sm:w-auto">
          <input
            className="input w-full sm:w-56"
            placeholder="Search notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
          {activeTab !== 'archived' && (
            <button className="btn-primary w-full sm:w-auto justify-center" onClick={() => setShowModal(true)}>
              <FiPlus size={15} /> New note
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
              activeTab === tab.id
                ? 'border-brass-400 text-brass-400'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            {tab.id === 'archived' && <FiArchive size={12} />}
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="text-xs text-text-faint font-mono">({tab.count})</span>
            )}
          </button>
        ))}
      </div>

      {queryFailed ? (
        <ErrorState
          error={apiErrorMessage(queryError, 'Could not load your notes.')}
          onRetry={retryQuery}
          retryLabel="Reload"
        />
      ) : isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={activeTab === 'archived' ? <FiArchive size={20} /> : <FiFileText size={20} />}
          title={
            search
              ? 'No notes match your search'
              : activeTab === 'archived'
              ? 'No archived notes'
              : activeTab === 'all'
              ? 'No notes yet'
              : `No ${activeTab} notes`
          }
          description={
            search
              ? 'Try a different keyword or clear your search.'
              : activeTab === 'archived'
              ? 'Archived notes appear here. Archive a note to clear your main view without deleting it.'
              : activeTab === 'all'
              ? 'Capture your first idea, snippet reference or meeting summary.'
              : `${activeTab === 'pinned' ? 'Pin' : 'Favorite'} notes to see them here.`
          }
          action={
            activeTab === 'all' && !search ? (
              <button className="btn-primary" onClick={() => setShowModal(true)}>
                <FiPlus size={14} /> Create first note
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onTogglePin={handleTogglePin}
              onToggleFavorite={handleToggleFavorite}
              onToggleArchive={(id) => handleToggleArchive(id, note.isArchived)}
              onEdit={setEditingNote}
              onDelete={handleDelete}
              onPreview={setPreviewingNote}
            />
          ))}
        </div>
      )}

      {showModal && (
        <NewNoteModal
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
        />
      )}
      {editingNote && (
        <EditNoteModal
          note={editingNote}
          onClose={() => setEditingNote(null)}
          onSave={handleEdit}
        />
      )}
      {previewingNote && (
        <NotePreviewModal
          note={previewingNote}
          onClose={() => setPreviewingNote(null)}
          onEdit={(note) => {
            setPreviewingNote(null);
            setEditingNote(note);
          }}
          onTogglePin={handleTogglePin}
          onToggleFavorite={handleToggleFavorite}
          onToggleArchive={(id) => handleToggleArchive(id, previewingNote.isArchived)}
          onDelete={(id) => {
            setPreviewingNote(null);
            handleDelete(id);
          }}
        />
      )}
    </div>
  );
}
