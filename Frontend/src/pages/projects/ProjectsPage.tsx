import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FiPlus, FiFolder, FiX } from 'react-icons/fi';
import { projectsService } from '@/services/projectsService';
import ProjectCard from '@/components/projects/ProjectCard';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';
import toast from 'react-hot-toast';
import type { Project } from '@/types';

const COLORS = ['#E8A33D', '#5EEAD4', '#F87171', '#818CF8', '#34D399', '#60A5FA', '#F472B6', '#A78BFA'];

interface ProjectFormState {
  name: string;
  description: string;
  color: string;
}

const defaultForm = (): ProjectFormState => ({ name: '', description: '', color: COLORS[0] });

export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [form, setForm] = useState<ProjectFormState>(defaultForm());

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
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : 'Failed to create project');
      toast.error(String(msg));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ProjectFormState> }) =>
      projectsService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project updated');
      closeModal();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : 'Failed to update project');
      toast.error(String(msg));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: projectsService.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Project deleted');
    },
    onError: () => toast.error('Failed to delete project'),
  });

  function openEdit(project: Project) {
    setEditingProject(project);
    setForm({ name: project.name, description: project.description ?? '', color: project.color });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingProject(null);
    setForm(defaultForm());
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (editingProject) {
      updateMutation.mutate({ id: editingProject.id, payload: { ...form, name: form.name.trim() } });
    } else {
      createMutation.mutate({ ...form, name: form.name.trim() });
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="sticky top-14 z-[5] bg-ink -mx-4 px-4 sm:-mx-6 sm:px-6 pt-2 pb-4 flex items-center justify-between gap-4 flex-wrap border-b border-border/50">
        <div>
          <h1 className="font-display text-2xl font-semibold">Projects</h1>
          <p className="text-sm text-text-muted mt-1">
            Track work across every client and side project.
          </p>
        </div>
        <button className="btn-primary" onClick={() => { setShowModal(true); setEditingProject(null); setForm(defaultForm()); }}>
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
            <ProjectCard
              key={p.id}
              project={p}
              onEdit={openEdit}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={closeModal}>
          <div className="card w-full max-w-xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
              <h2 className="font-display font-semibold text-lg">
                {editingProject ? 'Edit project' : 'New project'}
              </h2>
              <button onClick={closeModal} className="text-text-muted hover:text-text transition-colors">
                <FiX size={18} />
              </button>
            </div>

            {/* Scrollable body */}
            <form id="project-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 pb-4 space-y-4 min-h-0">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-muted uppercase tracking-wide">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. DevVault Mobile"
                  className="input w-full"
                  maxLength={100}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-muted uppercase tracking-wide">
                  Description
                </label>
                <textarea
                  rows={5}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the project goals, scope, tech stack, client details…"
                  className="input w-full resize-none"
                  maxLength={1000}
                />
                <p className="text-xs text-text-faint text-right">{form.description.length}/1000</p>
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
                      onClick={() => setForm((f) => ({ ...f, color: c }))}
                      className="w-7 h-7 rounded-full border-2 transition-all"
                      style={{
                        backgroundColor: c,
                        borderColor: form.color === c ? '#fff' : 'transparent',
                        transform: form.color === c ? 'scale(1.15)' : 'scale(1)',
                      }}
                    />
                  ))}
                </div>
              </div>
            </form>

            {/* Sticky footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-border shrink-0">
              <button type="button" onClick={closeModal} className="btn-ghost">
                Cancel
              </button>
              <button
                type="submit"
                form="project-form"
                className="btn-primary"
                disabled={!form.name.trim() || isPending}
              >
                {isPending ? 'Saving…' : editingProject ? 'Save changes' : 'Create project'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
