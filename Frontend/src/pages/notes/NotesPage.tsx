import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FiPlus, FiFileText, FiArchive } from 'react-icons/fi';
import toast from 'react-hot-toast';
import NoteCard from '@/components/notes/NoteCard';
import NewNoteModal from '@/components/notes/NewNoteModal';
import EditNoteModal from '@/components/notes/EditNoteModal';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';
import { notesService } from '@/services/notesService';
import type { Note } from '@/types';

type FilterTab = 'all' | 'pinned' | 'favorites' | 'archived';

export default function NotesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  const { data: notes, isLoading } = useQuery({
    queryKey: ['notes'],
    queryFn: notesService.list,
  });

  const filtered = useMemo(() => {
    if (!notes) return [];
    let result = notes;

    if (activeTab === 'archived') {
      result = result.filter((n) => n.isArchived);
    } else {
      // Non-archived tabs only show active notes
      result = result.filter((n) => !n.isArchived);
      if (activeTab === 'pinned') result = result.filter((n) => n.isPinned);
      if (activeTab === 'favorites') result = result.filter((n) => n.isFavorite);
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
  }, [notes, search, activeTab]);

  const archivedCount = useMemo(() => notes?.filter((n) => n.isArchived).length ?? 0, [notes]);
  const activeNotes = useMemo(() => notes?.filter((n) => !n.isArchived) ?? [], [notes]);

  async function handleTogglePin(id: string) {
    await notesService.togglePin(id);
    queryClient.invalidateQueries({ queryKey: ['notes'] });
  }

  async function handleToggleFavorite(id: string) {
    await notesService.toggleFavorite(id);
    queryClient.invalidateQueries({ queryKey: ['notes'] });
  }

  async function handleToggleArchive(id: string, currentlyArchived: boolean) {
    await notesService.toggleArchive(id);
    queryClient.invalidateQueries({ queryKey: ['notes'] });
    toast.success(currentlyArchived ? 'Note restored' : 'Note archived');
  }

  async function handleDelete(id: string) {
    await notesService.delete(id);
    queryClient.invalidateQueries({ queryKey: ['notes'] });
    toast.success('Note deleted');
  }

  async function handleCreate(input: { title: string; content: string; tags: string[] }) {
    await notesService.create(input);
    queryClient.invalidateQueries({ queryKey: ['notes'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    toast.success('Note saved');
  }

  async function handleEdit(id: string, data: { title: string; content: string; tags: string[] }) {
    await notesService.update(id, data);
    queryClient.invalidateQueries({ queryKey: ['notes'] });
    toast.success('Note updated');
  }

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

      {isLoading ? (
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
    </div>
  );
}
