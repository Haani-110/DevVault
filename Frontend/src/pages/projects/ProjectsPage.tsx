import { useQuery } from '@tanstack/react-query';
import { FiPlus, FiFolder } from 'react-icons/fi';
import { projectsService } from '@/services/projectsService';
import ProjectCard from '@/components/projects/ProjectCard';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';

export default function ProjectsPage() {
  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsService.list,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold">Projects</h1>
          <p className="text-sm text-text-muted mt-1">
            Track work across every client and side project.
          </p>
        </div>
        <button className="btn-primary">
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
    </div>
  );
}
