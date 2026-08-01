import { Link } from 'react-router-dom';
import type { IconType } from 'react-icons';
import Tilt3D from '@/components/ui/Tilt3D';

interface Props {
  label: string;
  value: string | number;
  sub?: string;
  icon: IconType;
  to?: string;
  /** 'attention' adds a small dot next to the number — used sparingly (e.g. pending tasks), not as a rainbow of theme colors. */
  accent?: 'default' | 'attention';
}

export default function StatCard({ label, value, sub, icon: Icon, to, accent = 'default' }: Props) {
  const numericValue = typeof value === 'number' ? value : parseInt(String(value), 10);

  const inner = (
    <div className="card p-5 relative overflow-hidden group-hover:border-brass-400/30 transition-colors h-full">
      {/* Thin gold ledger-tab accent, consistent across every card — one
          identity, not a different theme color per stat. */}
      <div className="absolute top-0 left-5 right-5 h-[2px] bg-gradient-to-r from-brass-400/70 via-brass-400/15 to-transparent" />
      <div className="absolute -right-6 -top-6 w-28 h-28 dial-ticks opacity-[0.15] pointer-events-none" />

      <div className="relative flex flex-col gap-3 h-full">
        <div className="flex items-start justify-between">
          <p className="text-[11px] font-semibold text-text-faint uppercase tracking-[0.1em]">{label}</p>
          <Icon size={14} className="text-text-faint" />
        </div>

        <div>
          <p className="font-mono text-3xl font-semibold text-text tabular-nums flex items-center gap-2">
            {value}
            {accent === 'attention' && numericValue > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-danger" aria-hidden="true" />
            )}
          </p>
          {sub && <p className="text-xs text-text-faint mt-1">{sub}</p>}
        </div>

        {to && (
          <div className="text-xs font-medium opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center gap-1 text-brass-400 mt-auto">
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
