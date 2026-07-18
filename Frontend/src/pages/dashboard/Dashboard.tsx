import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  FiFileText, FiCode, FiFolder, FiCheckSquare,
  FiArrowRight, FiCheck, FiZap,
} from 'react-icons/fi';
import StatCard from '@/components/dashboard/StatCard';
import ActivityFeed from '@/components/dashboard/ActivityFeed';
import StorageGauge from '@/components/dashboard/StorageGauge';
import WeeklyChart from '@/components/dashboard/WeeklyChart';
import Skeleton from '@/components/ui/Skeleton';
import { dashboardService } from '@/services/dashboardService';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';

export default function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardService.getStats(),
  });

  const pendingTasks = data ? data.totalTasks - data.completedTasks : 0;
  const completionPct =
    data && data.totalTasks > 0
      ? Math.round((data.completedTasks / data.totalTasks) * 100)
      : 0;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const gettingStartedSteps = [
    {
      done: (data?.totalNotes ?? 0) > 0,
      label: 'Create your first note',
      sub: 'Capture an idea, reference, or meeting summary',
      to: '/notes',
      icon: FiFileText,
    },
    {
      done: (data?.totalSnippets ?? 0) > 0,
      label: 'Save a code snippet',
      sub: 'Store reusable code with syntax highlighting',
      to: '/snippets',
      icon: FiCode,
    },
    {
      done: (data?.totalProjects ?? 0) > 0,
      label: 'Start a project',
      sub: 'Organize tasks on a kanban board',
      to: '/projects',
      icon: FiFolder,
    },
  ];

  const stepsComplete = gettingStartedSteps.filter((s) => s.done).length;
  const allDone = stepsComplete === gettingStartedSteps.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold">
            {greeting}, {user?.username?.split('.')[0] ?? 'developer'} 👋
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Here's what's happening across your vault today.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/notes" className="btn-ghost text-xs py-1.5 px-3">
            New note <FiArrowRight size={13} />
          </Link>
          <Link to="/snippets" className="btn-primary text-xs py-1.5 px-3">
            New snippet <FiArrowRight size={13} />
          </Link>
        </div>
      </div>

      {/* Getting Started — visible until all 3 steps done */}
      {!isLoading && !allDone && (
        <div className="card p-5 border-brass-400/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-brass-400/10 flex items-center justify-center">
                <FiZap size={14} className="text-brass-400" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-sm">Get started with DevVault</h3>
                <p className="text-xs text-text-faint">{stepsComplete} of {gettingStartedSteps.length} completed</p>
              </div>
            </div>
            {/* Progress bar */}
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-24 h-1.5 rounded-full bg-surface-hover overflow-hidden">
                <div
                  className="h-full rounded-full bg-brass-400 transition-all"
                  style={{ width: `${(stepsComplete / gettingStartedSteps.length) * 100}%` }}
                />
              </div>
              <span className="text-xs font-mono text-text-faint">
                {Math.round((stepsComplete / gettingStartedSteps.length) * 100)}%
              </span>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            {gettingStartedSteps.map((step) => {
              const Icon = step.icon;
              return (
                <Link
                  key={step.to}
                  to={step.to}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors group ${
                    step.done
                      ? 'border-green-400/20 bg-green-400/5 cursor-default pointer-events-none'
                      : 'border-border hover:border-brass-400/40 hover:bg-surface-hover'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    step.done ? 'bg-green-400/10' : 'bg-surface-hover group-hover:bg-brass-400/10'
                  }`}>
                    {step.done
                      ? <FiCheck size={14} className="text-green-400" />
                      : <Icon size={14} className="text-text-muted group-hover:text-brass-400 transition-colors" />
                    }
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-medium ${step.done ? 'text-green-400 line-through decoration-green-400/50' : 'text-text'}`}>
                      {step.label}
                    </p>
                    <p className="text-[11px] text-text-faint mt-0.5 leading-relaxed">{step.sub}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Stat cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Notes" value={data?.totalNotes ?? 0} icon={FiFileText} to="/notes" color="brass" />
          <StatCard label="Snippets" value={data?.totalSnippets ?? 0} icon={FiCode} to="/snippets" color="violet" />
          <StatCard label="Projects" value={data?.totalProjects ?? 0} icon={FiFolder} to="/projects" color="mint" />
          <StatCard
            label="Pending tasks"
            value={pendingTasks}
            icon={FiCheckSquare}
            sub={data && data.totalTasks > 0 ? `${completionPct}% completed` : 'No tasks yet'}
            color="red"
          />
        </div>
      )}

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Chart */}
          {isLoading ? (
            <Skeleton className="h-72" />
          ) : (
            <WeeklyChart weeklyActivity={data?.weeklyActivity ?? []} />
          )}

          {/* Storage + Recent Notes */}
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="card p-5 space-y-4">
              <h3 className="font-display font-semibold text-sm">Storage</h3>
              {isLoading ? (
                <Skeleton className="h-8" />
              ) : (
                <StorageGauge
                  label="Used"
                  used={+((data?.storageUsed ?? 0) / 1024).toFixed(2)}
                  limit={+((data?.storageLimit ?? 5120) / 1024).toFixed(0)}
                  unit="GB"
                />
              )}
            </div>

            {/* Recent Notes */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-sm">Recent notes</h3>
                <Link to="/notes" className="text-[11px] text-brass-400 hover:underline flex items-center gap-1">
                  View all <FiArrowRight size={10} />
                </Link>
              </div>
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8" />)}
                </div>
              ) : data?.recentNotes && data.recentNotes.length > 0 ? (
                <div className="space-y-1">
                  {data.recentNotes.map((note) => (
                    <Link
                      key={note.id}
                      to="/notes"
                      className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-surface-hover transition-colors group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FiFileText size={12} className="text-text-faint shrink-0" />
                        <span className="text-xs text-text-muted group-hover:text-text truncate transition-colors">
                          {note.title}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-text-faint shrink-0 ml-2">
                        {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-20 text-center">
                  <FiFileText size={18} className="text-text-faint mb-2" />
                  <p className="text-xs text-text-faint">No notes yet</p>
                  <Link to="/notes" className="text-xs text-brass-400 hover:underline mt-1">
                    Create one →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Activity feed */}
        <div>
          {isLoading ? (
            <Skeleton className="h-[440px]" />
          ) : (
            <ActivityFeed items={data?.recentActivity ?? []} />
          )}
        </div>
      </div>
    </div>
  );
}
