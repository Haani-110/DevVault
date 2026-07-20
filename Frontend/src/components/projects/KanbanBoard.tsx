import { useState, type DragEvent } from 'react';
import { FiPlus } from 'react-icons/fi';
import clsx from 'clsx';
import TaskCard from './TaskCard';
import type { Task, TaskStatus, TaskPriority } from '@/types';

const columns: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'BACKLOG', label: 'Backlog', color: 'text-text-muted' },
  { status: 'IN_PROGRESS', label: 'In progress', color: 'text-blue-400' },
  { status: 'IN_REVIEW', label: 'In review', color: 'text-brass-400' },
  { status: 'DONE', label: 'Done', color: 'text-green-400' },
];

const priorities: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'LOW', label: 'Low', color: 'text-text-muted' },
  { value: 'MEDIUM', label: 'Medium', color: 'text-blue-400' },
  { value: 'HIGH', label: 'High', color: 'text-brass-400' },
  { value: 'URGENT', label: 'Urgent', color: 'text-red-400' },
];

interface Props {
  tasks: Task[];
  onMove: (taskId: string, status: TaskStatus) => void;
  onCreateTask?: (status: TaskStatus, title: string, priority: TaskPriority, dueDate?: string) => void;
  onDeleteTask?: (taskId: string) => void;
}

export default function KanbanBoard({ tasks, onMove, onCreateTask, onDeleteTask }: Props) {
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);
  const [addingTo, setAddingTo] = useState<TaskStatus | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('MEDIUM');
  const [newTaskDue, setNewTaskDue] = useState('');

  function handleDragStart(e: DragEvent, taskId: string) {
    e.dataTransfer.setData('text/plain', taskId);
  }

  function handleDrop(e: DragEvent, status: TaskStatus) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) onMove(taskId, status);
    setDragOverCol(null);
  }

  function startAdding(status: TaskStatus) {
    setAddingTo(status);
    setNewTaskTitle('');
    setNewTaskPriority('MEDIUM');
    setNewTaskDue('');
  }

  function commitAdd(status: TaskStatus) {
    if (newTaskTitle.trim() && onCreateTask) {
      onCreateTask(status, newTaskTitle.trim(), newTaskPriority, newTaskDue || undefined);
    }
    setAddingTo(null);
    setNewTaskTitle('');
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
              'rounded-lg border border-border bg-ink-soft p-3 min-h-[320px] flex flex-col transition-colors',
              dragOverCol === col.status && 'border-brass-400/50 bg-brass-400/5'
            )}
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <h4 className={clsx('text-xs font-semibold uppercase tracking-wide', col.color)}>
                {col.label}
              </h4>
              <span className="text-xs font-mono text-text-faint">{colTasks.length}</span>
            </div>

            <div className="space-y-2.5 flex-1">
              {colTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onDragStart={handleDragStart}
                  onDelete={onDeleteTask}
                  onMove={onMove}
                />
              ))}
            </div>

            {/* Inline task creation */}
            {addingTo === col.status ? (
              <div className="mt-2.5 space-y-2">
                <input
                  autoFocus
                  className="input text-xs py-1.5"
                  placeholder="Task title…"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitAdd(col.status);
                    if (e.key === 'Escape') setAddingTo(null);
                  }}
                />
                <div className="flex gap-2">
                  <select
                    className="input text-xs py-1 flex-1"
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
                  >
                    {priorities.map((p) => (
                      <option key={p.value} value={p.value}>{p.label} priority</option>
                    ))}
                  </select>
                  <input
                    type="date"
                    className="input text-xs py-1 flex-1"
                    value={newTaskDue}
                    onChange={(e) => setNewTaskDue(e.target.value)}
                    title="Due date (optional)"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn-primary text-xs py-1 px-3"
                    onClick={() => commitAdd(col.status)}
                  >
                    Add
                  </button>
                  <button
                    className="btn-ghost text-xs py-1 px-3"
                    onClick={() => setAddingTo(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              onCreateTask && (
                <button
                  onClick={() => startAdding(col.status)}
                  className="mt-2.5 flex items-center gap-1.5 text-xs text-text-faint hover:text-text-muted transition-colors w-full px-1 py-1 rounded hover:bg-surface-hover"
                >
                  <FiPlus size={13} /> Add task
                </button>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}
