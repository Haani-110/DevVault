import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FiArrowLeft, FiEdit2, FiX, FiCheckCircle, FiCircle, FiClock, FiAlertCircle } from 'react-icons/fi';
import { projectsService } from '@/services/projectsService';
import KanbanBoard from '@/components/projects/KanbanBoard';
import Skeleton from '@/components/ui/Skeleton';
import toast from 'react-hot-toast';
import type { TaskStatus, TaskPriority, Project } from '@/types';

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

  const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: projectsService.list });
  const project = projects?.find((p) => p.id === id);

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks', id],
    queryFn: () => projectsService.listTasks(id!),
    enabled: !!id,
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

      {/* Edit project modal */}
      {editOpen && project && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setEditOpen(false)}
        >
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
      )}
    </div>
  );
}
