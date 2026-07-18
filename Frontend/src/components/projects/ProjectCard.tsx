import { Link } from 'react-router-dom';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import Tilt3D from '@/components/ui/Tilt3D';
import type { Project } from '@/types';

interface Props {
  project: Project;
  onEdit?: (project: Project) => void;
  onDelete?: (id: string) => void;
}

export default function ProjectCard({ project, onEdit, onDelete }: Props) {
  const pct = Math.round((project.completedCount / project.taskCount) * 100) || 0;

  return (
    <Tilt3D strength={7}>
      <div className="card p-5 flex flex-col gap-4 hover:border-brass-400/30 transition-colors group h-full">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/projects/${project.id}`} className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
              <h3 className="font-display font-semibold text-sm truncate">{project.name}</h3>
            </div>
            <p className="text-xs text-text-muted line-clamp-2">{project.description}</p>
          </Link>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {onEdit && (
              <button
                onClick={(e) => { e.preventDefault(); onEdit(project); }}
                aria-label="Edit project"
                className="w-7 h-7 flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-surface-hover"
              >
                <FiEdit2 size={13} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => { e.preventDefault(); onDelete(project.id); }}
                aria-label="Delete project"
                className="w-7 h-7 flex items-center justify-center rounded text-text-muted hover:text-danger hover:bg-surface-hover"
              >
                <FiTrash2 size={13} />
              </button>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5 text-xs text-text-muted">
            <span>{project.completedCount} / {project.taskCount} tasks</span>
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
      </div>
    </Tilt3D>
  );
}
