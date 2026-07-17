import type { DragEvent } from 'react';
import { FiTrash2 } from 'react-icons/fi';
import Badge from '@/components/ui/Badge';
import type { Task } from '@/types';

const priorityTone = {
  LOW: 'muted',
  MEDIUM: 'mint',
  HIGH: 'brass',
  URGENT: 'danger',
} as const;

interface Props {
  task: Task;
  onDragStart: (e: DragEvent, taskId: string) => void;
  onDelete?: (taskId: string) => void;
}

export default function TaskCard({ task, onDragStart, onDelete }: Props) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      className="card p-3 cursor-grab active:cursor-grabbing hover:border-brass-400/30 transition-colors group"
    >
      <div className="flex items-start justify-between gap-1 mb-2.5">
        <p className="text-sm text-text leading-snug">{task.title}</p>
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task.id);
            }}
            aria-label="Delete task"
            className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded text-text-muted hover:text-danger hover:bg-surface-hover transition-all shrink-0"
          >
            <FiTrash2 size={12} />
          </button>
        )}
      </div>
      {task.description && (
        <p className="text-xs text-text-faint line-clamp-2 mb-2 leading-relaxed">
          {task.description}
        </p>
      )}
      <div className="flex items-center justify-between">
        <Badge tone={priorityTone[task.priority]}>{task.priority}</Badge>
        {task.dueDate && (
          <span className="text-[11px] font-mono text-text-faint">
            {new Date(task.dueDate).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}
