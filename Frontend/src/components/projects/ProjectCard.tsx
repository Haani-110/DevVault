import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import type { Project } from '@/types';

export default function ProjectCard({ project }: { project: Project }) {
  const pct = Math.round((project.completedCount / project.taskCount) * 100) || 0;

  return (
    <Link
      to={`/projects/${project.id}`}
      className="card p-5 flex flex-col gap-4 hover:border-brass-400/30 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }} />
            <h3 className="font-display font-semibold text-sm">{project.name}</h3>
          </div>
          <p className="text-xs text-text-muted line-clamp-2">{project.description}</p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5 text-xs text-text-muted">
          <span>
            {project.completedCount} / {project.taskCount} tasks
          </span>
          <span className="font-mono">{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-hover overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: project.color }}
          />
        </div>
      </div>

      <p className="text-[11px] text-text-faint font-mono">
        Updated {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
      </p>
    </Link>
  );
}
