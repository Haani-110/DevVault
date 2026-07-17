import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FiArrowLeft } from 'react-icons/fi';
import { projectsService } from '@/services/projectsService';
import KanbanBoard from '@/components/projects/KanbanBoard';
import Skeleton from '@/components/ui/Skeleton';
import toast from 'react-hot-toast';
import type { TaskStatus } from '@/types';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: projectsService.list });
  const project = projects?.find((p) => p.id === id);

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks', id],
    queryFn: () => projectsService.listTasks(id!),
    enabled: !!id,
  });

  async function handleMove(taskId: string, newStatus: TaskStatus) {
    await projectsService.moveTask(taskId, newStatus);
    queryClient.invalidateQueries({ queryKey: ['tasks', id] });
  }

  async function handleCreateTask(status: TaskStatus, title: string) {
    if (!id) return;
    try {
      await projectsService.createTask(id, { title, priority: 'MEDIUM', status });
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

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text mb-3"
        >
          <FiArrowLeft size={13} /> All projects
        </Link>
        <div className="flex items-center gap-2.5">
          {project && (
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: project.color }} />
          )}
          <h1 className="font-display text-2xl font-semibold">{project?.name ?? 'Project'}</h1>
        </div>
        {project?.description && (
          <p className="text-sm text-text-muted mt-1">{project.description}</p>
        )}
        {tasks && (
          <p className="text-xs text-text-faint mt-1 font-mono">
            {tasks.filter((t) => t.status === 'DONE').length} / {tasks.length} tasks completed
          </p>
        )}
      </div>

      {isLoading || !tasks ? (
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      ) : (
        <KanbanBoard
          tasks={tasks}
          onMove={handleMove}
          onCreateTask={handleCreateTask}
          onDeleteTask={handleDeleteTask}
        />
      )}
    </div>
  );
}
