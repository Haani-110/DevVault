import { useQuery } from '@tanstack/react-query';
import { FiFileText, FiCode, FiFolder, FiCheckSquare } from 'react-icons/fi';
import StatCard from '@/components/dashboard/StatCard';
import ActivityFeed from '@/components/dashboard/ActivityFeed';
import StorageGauge from '@/components/dashboard/StorageGauge';
import WeeklyChart from '@/components/dashboard/WeeklyChart';
import Skeleton from '@/components/ui/Skeleton';
import { dashboardService } from '@/services/dashboardService';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';

export default function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardService.getStats(),
  });

  const pendingTasks = data ? data.totalTasks - data.completedTasks : 0;
  const completionPct = data && data.totalTasks > 0
    ? Math.round((data.completedTasks / data.totalTasks) * 100)
    : 0;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

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

      {/* Stat cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Notes"
            value={data?.totalNotes ?? 0}
            icon={FiFileText}
            to="/notes"
            color="brass"
          />
          <StatCard
            label="Snippets"
            value={data?.totalSnippets ?? 0}
            icon={FiCode}
            to="/snippets"
            color="violet"
          />
          <StatCard
            label="Projects"
            value={data?.totalProjects ?? 0}
            icon={FiFolder}
            to="/projects"
            color="mint"
          />
          <StatCard
            label="Pending tasks"
            value={pendingTasks}
            icon={FiCheckSquare}
            sub={
              data && data.totalTasks > 0
                ? `${completionPct}% completed`
                : 'No tasks yet'
            }
            color="red"
          />
        </div>
      )}

      {/* Main content grid */}
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Chart */}
          {isLoading ? (
            <Skeleton className="h-72" />
          ) : (
            <WeeklyChart weeklyActivity={data?.weeklyActivity ?? []} />
          )}

          {/* Usage + quick links */}
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="card p-5 space-y-4">
              <h3 className="font-display font-semibold text-sm">Storage</h3>
              {isLoading ? (
                <Skeleton className="h-8" />
              ) : (
                <StorageGauge
                  label="Used"
                  used={+(( data?.storageUsed ?? 0) / 1024).toFixed(2)}
                  limit={+((data?.storageLimit ?? 5120) / 1024).toFixed(0)}
                  unit="GB"
                />
              )}
            </div>

            <div className="card p-5">
              <h3 className="font-display font-semibold text-sm mb-4">Quick links</h3>
              <div className="space-y-2">
                {[
                  { to: '/notes', label: 'All notes', count: data?.totalNotes },
                  { to: '/snippets', label: 'All snippets', count: data?.totalSnippets },
                  { to: '/projects', label: 'All projects', count: data?.totalProjects },
                ].map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-surface-hover transition-colors group"
                  >
                    <span className="text-sm text-text-muted group-hover:text-text transition-colors">
                      {link.label}
                    </span>
                    <div className="flex items-center gap-2">
                      {link.count !== undefined && (
                        <span className="text-xs font-mono text-text-faint">{link.count}</span>
                      )}
                      <FiArrowRight size={12} className="text-text-faint group-hover:text-brass-400 transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
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
