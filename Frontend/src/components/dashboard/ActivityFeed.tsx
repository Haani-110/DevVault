import { FiFileText, FiCheckSquare, FiFolder, FiCode, FiLock, FiActivity } from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import type { IconType } from 'react-icons';
import type { RecentActivityItem } from '@/services/dashboardService';

const icons: Record<string, IconType> = {
  note: FiFileText,
  task: FiCheckSquare,
  project: FiFolder,
  snippet: FiCode,
  auth: FiLock,
};

const iconColors: Record<string, string> = {
  note: 'text-brass-400 bg-brass-400/10',
  task: 'text-mint-500 bg-mint-500/10',
  project: 'text-blue-400 bg-blue-400/10',
  snippet: 'text-violet-400 bg-violet-400/10',
  auth: 'text-red-400 bg-red-400/10',
};

export default function ActivityFeed({ items }: { items: RecentActivityItem[] }) {
  return (
    <div className="card p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-sm">Recent activity</h3>
        <FiActivity size={14} className="text-text-faint" />
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
          <div className="w-10 h-10 rounded-full bg-surface-hover flex items-center justify-center">
            <FiActivity size={16} className="text-text-faint" />
          </div>
          <div>
            <p className="text-sm text-text-muted">No activity yet</p>
            <p className="text-xs text-text-faint mt-0.5">
              Create a note, snippet or project to get started.
            </p>
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const Icon: IconType = icons[item.type] ?? FiActivity;
            const colorClass = iconColors[item.type] ?? 'text-text-muted bg-surface-hover';
            return (
              <li key={item.id} className="flex items-start gap-3">
                <div className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center ${colorClass}`}>
                  <Icon size={12} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text leading-snug line-clamp-1">{item.message}</p>
                  <p className="text-[11px] text-text-faint font-mono mt-0.5">
                    {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
