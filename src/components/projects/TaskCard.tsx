import type { DragEvent } from 'react';
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
}

export default function TaskCard({ task, onDragStart }: Props) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      className="card p-3 cursor-grab active:cursor-grabbing hover:border-brass-400/30 transition-colors"
    >
      <p className="text-sm text-text mb-2.5 leading-snug">{task.title}</p>
      <div className="flex items-center justify-between">
        <Badge tone={priorityTone[task.priority]}>{task.priority}</Badge>
        {task.dueDate && (
          <span className="text-[11px] font-mono text-text-faint">{task.dueDate}</span>
        )}
      </div>
    </div>
  );
}
