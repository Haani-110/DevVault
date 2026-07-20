import type { DragEvent } from 'react';
import { FiTrash2 } from 'react-icons/fi';
import Badge from '@/components/ui/Badge';
import type { Task, TaskStatus } from '@/types';

const priorityTone = {
  LOW: 'muted',
  MEDIUM: 'mint',
  HIGH: 'brass',
  URGENT: 'danger',
} as const;

const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: 'BACKLOG', label: 'Backlog' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'IN_REVIEW', label: 'In review' },
  { value: 'DONE', label: 'Done' },
];

interface Props {
  task: Task;
  onDragStart: (e: DragEvent, taskId: string) => void;
  onDelete?: (taskId: string) => void;
  onMove?: (taskId: string, status: TaskStatus) => void;
}

export default function TaskCard({ task, onDragStart, onDelete, onMove }: Props) {
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
            className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded text-text-muted hover:text-danger hover:bg-surface-hover transition-all shrink-0"
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
      <div className="flex items-center justify-between gap-2 mb-2">
        <Badge tone={priorityTone[task.priority]}>{task.priority}</Badge>
        {task.dueDate && (
          <span className="text-[11px] font-mono text-text-faint">
            {new Date(task.dueDate).toLocaleDateString()}
          </span>
        )}
      </div>
      {/* Touch-friendly move control — dragging cards between columns doesn't
          work on touchscreens (no native HTML5 drag support), so this dropdown
          is the way mobile/tablet users actually change a task's status. */}
      {onMove && (
        <select
          value={task.status}
          onChange={(e) => {
            e.stopPropagation();
            onMove(task.id, e.target.value as TaskStatus);
          }}
          onClick={(e) => e.stopPropagation()}
          aria-label="Move task to a different column"
          className="w-full text-[11px] py-1 px-1.5 rounded border border-border bg-surface-raised/60 text-text-muted focus:text-text focus:bg-surface-raised transition-colors"
        >
          {statusOptions.map((s) => (
            <option key={s.value} value={s.value}>
              Move to: {s.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
