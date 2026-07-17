import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

interface WeeklyChartProps {
  weeklyActivity: { day: string; notes: number; tasks: number }[];
}

export default function WeeklyChart({ weeklyActivity }: WeeklyChartProps) {
  const data = weeklyActivity.length > 0
    ? weeklyActivity
    : [
        { day: 'Mon', tasks: 0, notes: 0 },
        { day: 'Tue', tasks: 0, notes: 0 },
        { day: 'Wed', tasks: 0, notes: 0 },
        { day: 'Thu', tasks: 0, notes: 0 },
        { day: 'Fri', tasks: 0, notes: 0 },
        { day: 'Sat', tasks: 0, notes: 0 },
        { day: 'Sun', tasks: 0, notes: 0 },
      ];

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-sm">Weekly output</h3>
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-brass-400" /> Tasks
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-mint-500" /> Notes
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ left: -20, right: 10 }}>
          <defs>
            <linearGradient id="tasksGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E8A33D" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#E8A33D" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="notesGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2DD4BF" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#2DD4BF" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#262E42" vertical={false} />
          <XAxis dataKey="day" stroke="#5A6278" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="#5A6278" fontSize={12} tickLine={false} axisLine={false} width={24} />
          <Tooltip
            contentStyle={{
              background: '#1D2438',
              border: '1px solid #262E42',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: '#E6E9F0' }}
          />
          <Area
            type="monotone"
            dataKey="tasks"
            stroke="#E8A33D"
            fill="url(#tasksGrad)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="notes"
            stroke="#2DD4BF"
            fill="url(#notesGrad)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
