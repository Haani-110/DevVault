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

type FilterTab = 'all' | 'pinned' | 'favorites';

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
    if (activeTab === 'pinned') result = result.filter((n) => n.isPinned);
    if (activeTab === 'favorites') result = result.filter((n) => n.isFavorite);
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

  async function handleTogglePin(id: string) {
    await notesService.togglePin(id);
    queryClient.invalidateQueries({ queryKey: ['notes'] });
  }

  async function handleToggleFavorite(id: string) {
    await notesService.toggleFavorite(id);
    queryClient.invalidateQueries({ queryKey: ['notes'] });
  }

  async function handleToggleArchive(id: string) {
    await notesService.toggleArchive(id);
    queryClient.invalidateQueries({ queryKey: ['notes'] });
    toast.success('Note archived');
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

  const tabs: { id: FilterTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'pinned', label: 'Pinned' },
    { id: 'favorites', label: 'Favorites' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold">Notes</h1>
          <p className="text-sm text-text-muted mt-1">
            Markdown notes with tags, pinning and search.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            className="input w-56"
            placeholder="Search notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            <FiPlus size={15} /> New note
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-brass-400 text-brass-400'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            {tab.label}
            {tab.id === 'all' && notes && (
              <span className="ml-1.5 text-xs text-text-faint font-mono">({notes.length})</span>
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
          icon={<FiFileText size={20} />}
          title={search ? 'No notes match your search' : `No ${activeTab === 'all' ? '' : activeTab + ' '}notes yet`}
          description={
            search
              ? 'Try a different keyword or clear your search.'
              : activeTab === 'all'
              ? 'Capture your first idea, snippet reference or meeting summary.'
              : `${activeTab === 'pinned' ? 'Pin' : 'Favorite'} notes to see them here.`
          }
          action={
            !search && activeTab === 'all' && (
              <button className="btn-primary" onClick={() => setShowModal(true)}>
                <FiPlus size={15} /> New note
              </button>
            )
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
              onToggleArchive={handleToggleArchive}
              onEdit={setEditingNote}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Archive section */}
      {activeTab === 'all' && notes && notes.length > 0 && (
        <div className="pt-2">
          <button
            onClick={async () => {
              const archived = await notesService.list();
              // Show archived count as info
              toast(`${archived.length} active notes`, { icon: <FiArchive size={14} /> });
            }}
            className="text-xs text-text-faint hover:text-text-muted flex items-center gap-1.5"
          >
            <FiArchive size={12} /> Archived notes are hidden from this view
          </button>
        </div>
      )}

      {showModal && <NewNoteModal onClose={() => setShowModal(false)} onCreate={handleCreate} />}
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
