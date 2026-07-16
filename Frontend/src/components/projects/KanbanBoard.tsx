import { useState, type DragEvent } from 'react';
import clsx from 'clsx';
import TaskCard from './TaskCard';
import type { Task, TaskStatus } from '@/types';

const columns: { status: TaskStatus; label: string }[] = [
  { status: 'BACKLOG', label: 'Backlog' },
  { status: 'IN_PROGRESS', label: 'In progress' },
  { status: 'IN_REVIEW', label: 'In review' },
  { status: 'DONE', label: 'Done' },
];

interface Props {
  tasks: Task[];
  onMove: (taskId: string, status: TaskStatus) => void;
}

export default function KanbanBoard({ tasks, onMove }: Props) {
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);

  function handleDragStart(e: DragEvent, taskId: string) {
    e.dataTransfer.setData('text/plain', taskId);
  }

  function handleDrop(e: DragEvent, status: TaskStatus) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) onMove(taskId, status);
    setDragOverCol(null);
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {columns.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.status);
        return (
          <div
            key={col.status}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverCol(col.status);
            }}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={(e) => handleDrop(e, col.status)}
            className={clsx(
              'rounded-lg border border-border bg-ink-soft p-3 min-h-[320px] transition-colors',
              dragOverCol === col.status && 'border-brass-400/50 bg-brass-400/5'
            )}
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                {col.label}
              </h4>
              <span className="text-xs font-mono text-text-faint">{colTasks.length}</span>
            </div>
            <div className="space-y-2.5">
              {colTasks.map((task) => (
                <TaskCard key={task.id} task={task} onDragStart={handleDragStart} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
