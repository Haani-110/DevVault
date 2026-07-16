interface Props {
  label: string;
  used: number;
  limit: number;
  unit: string;
}

export default function StorageGauge({ label, used, limit, unit }: Props) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const tone = pct > 85 ? 'bg-danger' : pct > 60 ? 'bg-brass-400' : 'bg-mint-500';

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs font-medium text-text-muted">{label}</span>
        <span className="text-xs font-mono text-text-faint">
          {used}
          {unit} / {limit}
          {unit}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-hover overflow-hidden">
        <div
          className={`h-full ${tone} rounded-full transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
