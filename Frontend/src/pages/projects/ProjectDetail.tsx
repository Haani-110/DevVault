import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FiArrowLeft, FiEdit2, FiX, FiCheckCircle, FiCircle, FiClock, FiAlertCircle, FiFileText, FiCode, FiTrello } from 'react-icons/fi';
import { projectsService } from '@/services/projectsService';
import { notesService } from '@/services/notesService';
import { snippetsService } from '@/services/snippetsService';
import KanbanBoard from '@/components/projects/KanbanBoard';
import NoteCard from '@/components/notes/NoteCard';
import EditNoteModal from '@/components/notes/EditNoteModal';
import NotePreviewModal from '@/components/notes/NotePreviewModal';
import SnippetCard from '@/components/snippets/SnippetCard';
import SnippetModal from '@/components/snippets/SnippetModal';
import SnippetPreviewModal from '@/components/snippets/SnippetPreviewModal';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';
import toast from 'react-hot-toast';
import type { TaskStatus, TaskPriority, Project, Note, Snippet } from '@/types';

const COLORS = ['#E8A33D', '#5EEAD4', '#F87171', '#818CF8', '#34D399', '#60A5FA', '#F472B6', '#A78BFA'];

const statusMeta: { status: TaskStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { status: 'BACKLOG',     label: 'Backlog',     icon: <FiCircle size={13} />,      color: 'text-text-muted' },
  { status: 'IN_PROGRESS', label: 'In progress', icon: <FiClock size={13} />,       color: 'text-blue-400' },
  { status: 'IN_REVIEW',   label: 'In review',   icon: <FiAlertCircle size={13} />, color: 'text-brass-400' },
  { status: 'DONE',        label: 'Done',        icon: <FiCheckCircle size={13} />, color: 'text-green-400' },
];

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '', color: '' });
  const [activeTab, setActiveTab] = useState<'board' | 'notes' | 'snippets'>('board');

  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [previewingNote, setPreviewingNote] = useState<Note | null>(null);
  const [showSnippetModal, setShowSnippetModal] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);
  const [previewingSnippet, setPreviewingSnippet] = useState<Snippet | null>(null);

  const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: projectsService.list });
  const project = projects?.find((p) => p.id === id);

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks', id],
    queryFn: () => projectsService.listTasks(id!),
    enabled: !!id,
  });

  const { data: projectNotes, isLoading: notesLoading } = useQuery({
    queryKey: ['notes', { projectId: id }],
    queryFn: () => notesService.list(id),
    enabled: !!id && activeTab === 'notes',
  });

  const { data: projectSnippets, isLoading: snippetsLoading } = useQuery({
    queryKey: ['snippets', { projectId: id }],
    queryFn: () => snippetsService.list(id),
    enabled: !!id && activeTab === 'snippets',
  });

  function openEdit(p: Project) {
    setEditForm({ name: p.name, description: p.description ?? '', color: p.color });
    setEditOpen(true);
  }

  async function handleSaveEdit() {
    if (!id || !editForm.name.trim()) return;
    try {
      await projectsService.update(id, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || undefined,
        color: editForm.color,
      });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setEditOpen(false);
      toast.success('Project updated');
    } catch {
      toast.error('Failed to update project');
    }
  }

  async function handleMove(taskId: string, newStatus: TaskStatus) {
    await projectsService.moveTask(taskId, newStatus);
    queryClient.invalidateQueries({ queryKey: ['tasks', id] });
    queryClient.invalidateQueries({ queryKey: ['projects'] });
  }

  async function handleCreateTask(status: TaskStatus, title: string, priority: TaskPriority, dueDate?: string) {
    if (!id) return;
    try {
      await projectsService.createTask(id, { title, priority, status, dueDate });
      queryClient.invalidateQueries({ queryKey: ['tasks', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    } catch {
      toast.error('Failed to create task');
    }
  }

  async function handleDeleteTask(taskId: string) {
    try {
      await projectsService.deleteTask(taskId);
      queryClient.invalidateQueries({ queryKey: ['tasks', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Task deleted');
    } catch {
      toast.error('Failed to delete task');
    }
  }

  function invalidateNotes() {
    queryClient.invalidateQueries({ queryKey: ['notes', { projectId: id }] });
    queryClient.invalidateQueries({ queryKey: ['notes'] });
  }
  function invalidateSnippets() {
    queryClient.invalidateQueries({ queryKey: ['snippets', { projectId: id }] });
    queryClient.invalidateQueries({ queryKey: ['snippets'] });
  }

  async function handleTogglePin(noteId: string) {
    await notesService.togglePin(noteId);
    invalidateNotes();
  }
  async function handleToggleNoteFavorite(noteId: string) {
    await notesService.toggleFavorite(noteId);
    invalidateNotes();
  }
  async function handleToggleArchive(noteId: string, currentlyArchived: boolean) {
    await notesService.toggleArchive(noteId);
    invalidateNotes();
    toast.success(currentlyArchived ? 'Note restored' : 'Note archived');
  }
  async function handleDeleteNote(noteId: string) {
    await notesService.delete(noteId);
    invalidateNotes();
    toast.success('Note deleted');
  }
  async function handleSaveNote(noteId: string, data: { title: string; content: string; tags: string[] }) {
    await notesService.update(noteId, data);
    invalidateNotes();
    toast.success('Note updated');
  }

  async function handleToggleSnippetFavorite(snippetId: string) {
    await snippetsService.toggleFavorite(snippetId);
    invalidateSnippets();
  }
  async function handleDeleteSnippet(snippetId: string) {
    await snippetsService.delete(snippetId);
    invalidateSnippets();
    toast.success('Snippet deleted');
  }
  async function handleUpdateSnippet(snippetId: string, input: Parameters<typeof snippetsService.update>[1]) {
    await snippetsService.update(snippetId, input);
    invalidateSnippets();
    toast.success('Snippet updated');
  }

  const totalTasks = tasks?.length ?? 0;
  const doneTasks = tasks?.filter((t) => t.status === 'DONE').length ?? 0;
  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div>
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text mb-4 transition-colors"
        >
          <FiArrowLeft size={13} /> All projects
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            {project && (
              <div
                className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-sm font-bold text-ink shadow-md"
                style={{ backgroundColor: project.color }}
              >
                {project.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="font-display text-2xl font-semibold leading-tight">
                {project?.name ?? <Skeleton className="h-7 w-48 inline-block" />}
              </h1>
              {project?.description && (
                <p className="text-sm text-text-muted mt-0.5">{project.description}</p>
              )}
            </div>
          </div>

          {project && (
            <button
              onClick={() => openEdit(project)}
              className="btn-ghost text-xs py-1.5 px-3"
            >
              <FiEdit2 size={13} /> Edit project
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setActiveTab('board')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
            activeTab === 'board' ? 'border-brass-400 text-brass-400' : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          <FiTrello size={13} /> Board
          {totalTasks > 0 && <span className="text-xs text-text-faint font-mono">({totalTasks})</span>}
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
            activeTab === 'notes' ? 'border-brass-400 text-brass-400' : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          <FiFileText size={13} /> Notes
          {projectNotes && projectNotes.length > 0 && <span className="text-xs text-text-faint font-mono">({projectNotes.length})</span>}
        </button>
        <button
          onClick={() => setActiveTab('snippets')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
            activeTab === 'snippets' ? 'border-brass-400 text-brass-400' : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          <FiCode size={13} /> Snippets
          {projectSnippets && projectSnippets.length > 0 && <span className="text-xs text-text-faint font-mono">({projectSnippets.length})</span>}
        </button>
      </div>

      {activeTab === 'board' && (
        <>
      {/* Stats row */}
      {tasks && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statusMeta.map(({ status, label, icon, color }) => {
            const count = tasks.filter((t) => t.status === status).length;
            return (
              <div key={status} className="card p-4 flex items-center gap-3">
                <span className={color}>{icon}</span>
                <div>
                  <p className="stat-num text-xl font-semibold text-text">{count}</p>
                  <p className="text-xs text-text-faint">{label}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Progress bar */}
      {tasks && totalTasks > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2 text-xs">
            <span className="text-text-muted font-medium">Overall progress</span>
            <span className="font-mono text-text">
              {doneTasks}/{totalTasks} tasks · <span className="text-brass-400">{pct}%</span>
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-surface-hover overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                backgroundColor: project?.color ?? '#E8A33D',
              }}
            />
          </div>
        </div>
      )}

      {/* Kanban board */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      ) : (
        <>
          {totalTasks === 0 && (
            <div className="card p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center mx-auto mb-3">
                <FiCheckCircle size={20} className="text-text-faint" />
              </div>
              <p className="text-sm font-medium text-text-muted">No tasks yet</p>
              <p className="text-xs text-text-faint mt-1">
                Click "+ Add task" inside any column to create your first task.
              </p>
            </div>
          )}
          <KanbanBoard
            tasks={tasks ?? []}
            onMove={handleMove}
            onCreateTask={handleCreateTask}
            onDeleteTask={handleDeleteTask}
          />
        </>
      )}
        </>
      )}

      {activeTab === 'notes' && (
        notesLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
          </div>
        ) : !projectNotes || projectNotes.length === 0 ? (
          <EmptyState
            icon={<FiFileText size={20} />}
            title="No notes in this project yet"
            description="Notes you create or import into this project will show up here."
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projectNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onTogglePin={handleTogglePin}
                onToggleFavorite={handleToggleNoteFavorite}
                onToggleArchive={(noteId) => handleToggleArchive(noteId, note.isArchived)}
                onEdit={setEditingNote}
                onDelete={handleDeleteNote}
                onPreview={setPreviewingNote}
              />
            ))}
          </div>
        )
      )}

      {activeTab === 'snippets' && (
        snippetsLoading ? (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-52" />)}
          </div>
        ) : !projectSnippets || projectSnippets.length === 0 ? (
          <EmptyState
            icon={<FiCode size={20} />}
            title="No snippets in this project yet"
            description="Snippets you create or import into this project will show up here."
          />
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {projectSnippets.map((snippet) => (
              <SnippetCard
                key={snippet.id}
                snippet={snippet}
                onEdit={(s) => { setEditingSnippet(s); setShowSnippetModal(true); }}
                onToggleFavorite={handleToggleSnippetFavorite}
                onDelete={handleDeleteSnippet}
                onPreview={setPreviewingSnippet}
              />
            ))}
          </div>
        )
      )}

      {/* Edit project modal */}
      {editOpen && project && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm"
          onClick={() => setEditOpen(false)}
        >
          <div className="flex min-h-full items-center justify-center p-4 pt-16 pb-8">
          <div
            className="card w-full max-w-md p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display font-semibold text-lg">Edit project</h2>
              <button onClick={() => setEditOpen(false)} className="text-text-muted hover:text-text">
                <FiX size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">Name</label>
                <input
                  autoFocus
                  className="input"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea
                  className="input resize-none min-h-20"
                  value={editForm.description}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="What is this project about?"
                />
              </div>
              <div>
                <label className="label">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditForm((f) => ({ ...f, color: c }))}
                      className="w-7 h-7 rounded-full border-2 transition-all"
                      style={{
                        backgroundColor: c,
                        borderColor: editForm.color === c ? '#fff' : 'transparent',
                        transform: editForm.color === c ? 'scale(1.2)' : 'scale(1)',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button className="btn-ghost" onClick={() => setEditOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveEdit} disabled={!editForm.name.trim()}>
                Save changes
              </button>
            </div>
          </div>
          </div>
        </div>
      )}

      {editingNote && (
        <EditNoteModal
          note={editingNote}
          onClose={() => setEditingNote(null)}
          onSave={handleSaveNote}
        />
      )}
      {previewingNote && (
        <NotePreviewModal
          note={previewingNote}
          onClose={() => setPreviewingNote(null)}
          onEdit={(note) => { setPreviewingNote(null); setEditingNote(note); }}
          onTogglePin={handleTogglePin}
          onToggleFavorite={handleToggleNoteFavorite}
          onToggleArchive={(noteId) => handleToggleArchive(noteId, previewingNote.isArchived)}
          onDelete={(noteId) => { setPreviewingNote(null); handleDeleteNote(noteId); }}
        />
      )}
      {showSnippetModal && (
        <SnippetModal
          snippet={editingSnippet}
          onClose={() => { setShowSnippetModal(false); setEditingSnippet(null); }}
          onCreate={async () => {}}
          onUpdate={handleUpdateSnippet}
        />
      )}
      {previewingSnippet && (
        <SnippetPreviewModal
          snippet={previewingSnippet}
          onClose={() => setPreviewingSnippet(null)}
          onEdit={(s) => { setPreviewingSnippet(null); setEditingSnippet(s); setShowSnippetModal(true); }}
          onToggleFavorite={handleToggleSnippetFavorite}
          onDelete={(snippetId) => { setPreviewingSnippet(null); handleDeleteSnippet(snippetId); }}
        />
      )}
    </div>
  );
}
