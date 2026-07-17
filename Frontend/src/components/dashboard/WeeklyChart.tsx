import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

interface WeeklyDataPoint {
  day: string;
  notes: number;
  tasks: number;
  snippets?: number;
}

interface WeeklyChartProps {
  weeklyActivity: WeeklyDataPoint[];
}

const FALLBACK: WeeklyDataPoint[] = [
  { day: 'Mon', tasks: 0, notes: 0, snippets: 0 },
  { day: 'Tue', tasks: 0, notes: 0, snippets: 0 },
  { day: 'Wed', tasks: 0, notes: 0, snippets: 0 },
  { day: 'Thu', tasks: 0, notes: 0, snippets: 0 },
  { day: 'Fri', tasks: 0, notes: 0, snippets: 0 },
  { day: 'Sat', tasks: 0, notes: 0, snippets: 0 },
  { day: 'Sun', tasks: 0, notes: 0, snippets: 0 },
];

// Custom tooltip
function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-raised border border-border rounded-lg px-3 py-2.5 text-xs shadow-lg">
      <p className="font-medium text-text mb-1.5">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-text-muted capitalize">{p.name}</span>
          <span className="font-mono text-text ml-auto pl-3">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function WeeklyChart({ weeklyActivity }: WeeklyChartProps) {
  const data = weeklyActivity.length > 0 ? weeklyActivity : FALLBACK;
  const isEmpty = data.every((d) => d.notes === 0 && d.tasks === 0 && (d.snippets ?? 0) === 0);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-display font-semibold text-sm">Weekly output</h3>
          <p className="text-xs text-text-faint mt-0.5">Your activity over the past 7 days</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-text-muted">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-brass-400" /> Tasks
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-mint-500" /> Notes
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-violet-400" /> Snippets
          </span>
        </div>
      </div>

      {isEmpty ? (
        <div className="h-[200px] flex flex-col items-center justify-center text-center gap-2">
          <p className="text-sm text-text-muted">No activity this week yet</p>
          <p className="text-xs text-text-faint">Create notes, tasks or snippets to see your output here</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ left: -20, right: 8, top: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="tasksGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E8A33D" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#E8A33D" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="notesGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2DD4BF" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#2DD4BF" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="snippetsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="day"
              stroke="var(--color-text-faint)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="var(--color-text-faint)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={24}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--color-border)', strokeWidth: 1 }} />
            <Area type="monotone" dataKey="tasks" stroke="#E8A33D" fill="url(#tasksGrad)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="notes" stroke="#2DD4BF" fill="url(#notesGrad)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="snippets" stroke="#a78bfa" fill="url(#snippetsGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
