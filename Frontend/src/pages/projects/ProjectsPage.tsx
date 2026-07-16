import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FiPlus, FiFolder, FiX } from 'react-icons/fi';
import { projectsService } from '@/services/projectsService';
import ProjectCard from '@/components/projects/ProjectCard';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';
import toast from 'react-hot-toast';

const COLORS = ['#E8A33D', '#5EEAD4', '#F87171', '#818CF8', '#34D399', '#60A5FA', '#F472B6', '#A78BFA'];

export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLORS[0]);

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsService.list,
  });

  const createMutation = useMutation({
    mutationFn: projectsService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Project created');
      closeModal();
    },
    onError: () => toast.error('Failed to create project'),
  });

  function closeModal() {
    setShowModal(false);
    setName('');
    setDescription('');
    setColor(COLORS[0]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({ name: name.trim(), description: description.trim() || undefined, color });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold">Projects</h1>
          <p className="text-sm text-text-muted mt-1">
            Track work across every client and side project.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <FiPlus size={15} /> New project
        </button>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : !projects || projects.length === 0 ? (
        <EmptyState
          icon={<FiFolder size={20} />}
          title="No projects yet"
          description="Create a project to start organizing tasks on a kanban board."
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}

      {/* New Project Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-semibold text-lg">New project</h2>
              <button onClick={closeModal} className="text-text-muted hover:text-text transition-colors">
                <FiX size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-muted uppercase tracking-wide">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. DevVault Mobile"
                  className="input w-full"
                  maxLength={100}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-muted uppercase tracking-wide">
                  Description
                </label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's this project about?"
                  className="input w-full"
                  maxLength={300}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-muted uppercase tracking-wide">
                  Color
                </label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className="w-7 h-7 rounded-full border-2 transition-all"
                      style={{
                        backgroundColor: c,
                        borderColor: color === c ? '#fff' : 'transparent',
                        transform: color === c ? 'scale(1.15)' : 'scale(1)',
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="btn-ghost">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={!name.trim() || createMutation.isPending}
                >
                  {createMutation.isPending ? 'Creating…' : 'Create project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
