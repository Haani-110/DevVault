import { Link } from 'react-router-dom';
import type { IconType } from 'react-icons';
import clsx from 'clsx';
import Tilt3D from '@/components/ui/Tilt3D';

interface Props {
  label: string;
  value: string | number;
  sub?: string;
  icon: IconType;
  to?: string;
  color?: 'brass' | 'mint' | 'violet' | 'red';
}

const colorMap = {
  brass:  { bg: 'bg-brass-400/10',   text: 'text-brass-400',   bar: 'bg-brass-400' },
  mint:   { bg: 'bg-mint-500/10',    text: 'text-mint-500',    bar: 'bg-mint-500' },
  violet: { bg: 'bg-violet-400/10',  text: 'text-violet-400',  bar: 'bg-violet-400' },
  red:    { bg: 'bg-red-400/10',     text: 'text-red-400',     bar: 'bg-red-400' },
};

export default function StatCard({ label, value, sub, icon: Icon, to, color = 'brass' }: Props) {
  const c = colorMap[color];

  const inner = (
    <div className="card p-5 relative overflow-hidden group-hover:border-brass-400/20 transition-colors h-full">
      {/* Background dial accent */}
      <div className="absolute -right-5 -top-5 w-24 h-24 dial-ticks opacity-20 pointer-events-none" />

      <div className="relative flex flex-col gap-3 h-full">
        <div className="flex items-start justify-between">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wide">{label}</p>
          <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', c.bg, c.text)}>
            <Icon size={15} />
          </div>
        </div>

        <div>
          <p className="stat-num text-3xl font-bold text-text">{value}</p>
          {sub && <p className="text-xs text-text-faint mt-1">{sub}</p>}
        </div>

        {to && (
          <div className={clsx('text-xs font-medium opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center gap-1', c.text)}>
            View all →
          </div>
        )}
      </div>
    </div>
  );

  if (to) {
    return (
      <Tilt3D strength={8}>
        <Link to={to} className="group block h-full">
          {inner}
        </Link>
      </Tilt3D>
    );
  }

  return <Tilt3D strength={8}>{inner}</Tilt3D>;
}
