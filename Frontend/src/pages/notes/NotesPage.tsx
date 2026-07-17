import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FiPlus, FiFileText } from 'react-icons/fi';
import toast from 'react-hot-toast';
import NoteCard from '@/components/notes/NoteCard';
import NewNoteModal from '@/components/notes/NewNoteModal';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';
import { notesService } from '@/services/notesService';

export default function NotesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  const { data: notes, isLoading } = useQuery({
    queryKey: ['notes'],
    queryFn: notesService.list,
  });

  const filtered = useMemo(() => {
    if (!notes) return [];
    if (!search.trim()) return notes;
    const q = search.toLowerCase();
    return notes.filter(
      (n) => n.title.toLowerCase().includes(q) || n.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [notes, search]);

  async function handleTogglePin(id: string) {
    await notesService.togglePin(id);
    queryClient.invalidateQueries({ queryKey: ['notes'] });
  }

  async function handleDelete(id: string) {
    await notesService.delete(id);
    queryClient.invalidateQueries({ queryKey: ['notes'] });
    toast.success('Note deleted');
  }

  async function handleCreate(input: { title: string; content: string; tags: string[] }) {
    await notesService.create(input);
    queryClient.invalidateQueries({ queryKey: ['notes'] });
    toast.success('Note saved');
  }

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

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FiFileText size={20} />}
          title={search ? 'No notes match your search' : 'No notes yet'}
          description={
            search
              ? 'Try a different keyword or clear your search.'
              : 'Capture your first idea, snippet reference or meeting summary.'
          }
          action={
            !search && (
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
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {showModal && <NewNoteModal onClose={() => setShowModal(false)} onCreate={handleCreate} />}
    </div>
  );
}
