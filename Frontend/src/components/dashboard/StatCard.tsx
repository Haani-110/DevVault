import type { IconType } from 'react-icons';

interface Props {
  label: string;
  value: string | number;
  sub?: string;
  icon: IconType;
}

export default function StatCard({ label, value, sub, icon: Icon }: Props) {
  return (
    <div className="card p-5 relative overflow-hidden">
      <div className="absolute -right-4 -top-4 w-20 h-20 dial-ticks opacity-30" />
      <div className="flex items-start justify-between relative">
        <div>
          <p className="text-xs font-medium text-text-muted mb-2">{label}</p>
          <p className="stat-num text-2xl font-semibold text-text">{value}</p>
          {sub && <p className="text-xs text-text-faint mt-1">{sub}</p>}
        </div>
        <div className="w-9 h-9 rounded bg-brass-400/10 text-brass-400 flex items-center justify-center">
          <Icon size={16} />
        </div>
      </div>
    </div>
  );
}
