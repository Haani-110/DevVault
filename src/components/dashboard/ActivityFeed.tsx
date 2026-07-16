import { FiFileText, FiCheckSquare, FiFolder, FiUpload, FiLock } from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import type { ActivityItem } from '@/types';

const icons = {
  note: FiFileText,
  task: FiCheckSquare,
  project: FiFolder,
  file: FiUpload,
  auth: FiLock,
};

export default function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <div className="card p-5">
      <h3 className="font-display font-semibold text-sm mb-4">Recent activity</h3>
      <ul className="space-y-4">
        {items.map((item) => {
          const Icon = icons[item.type];
          return (
            <li key={item.id} className="flex items-start gap-3">
              <div className="w-7 h-7 shrink-0 rounded-full bg-surface-hover flex items-center justify-center text-text-muted">
                <Icon size={13} />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-text leading-snug">{item.message}</p>
                <p className="text-xs text-text-faint font-mono mt-0.5">
                  {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
