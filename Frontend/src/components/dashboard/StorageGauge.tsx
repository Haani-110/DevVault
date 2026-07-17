import clsx from 'clsx';

interface Props {
  label: string;
  used: number;
  limit: number;
  unit?: string;
}

export default function StorageGauge({ label, used, limit, unit = '' }: Props) {
  const pct = limit > 0 ? Math.min(Math.round((used / limit) * 100), 100) : 0;
  const tone =
    pct >= 90 ? 'bg-red-400' :
    pct >= 70 ? 'bg-brass-400' :
    'bg-mint-500';

  const toneText =
    pct >= 90 ? 'text-red-400' :
    pct >= 70 ? 'text-brass-400' :
    'text-mint-500';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-muted font-medium">{label}</span>
        <span className={clsx('font-mono font-semibold', toneText)}>
          {used} / {limit}{unit ? ` ${unit}` : ''}
          <span className="text-text-faint font-normal ml-1.5">({pct}%)</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-surface-hover overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all duration-500', tone)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
