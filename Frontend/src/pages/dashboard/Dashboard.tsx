import { useQuery } from '@tanstack/react-query';
import { FiFileText, FiCode, FiFolder, FiCheckSquare } from 'react-icons/fi';
import StatCard from '@/components/dashboard/StatCard';
import ActivityFeed from '@/components/dashboard/ActivityFeed';
import StorageGauge from '@/components/dashboard/StorageGauge';
import WeeklyChart from '@/components/dashboard/WeeklyChart';
import Skeleton from '@/components/ui/Skeleton';
import { mockStats, mockActivity } from '@/services/mockData';
import { useAuth } from '@/hooks/useAuth';

async function fetchDashboard() {
  await new Promise((r) => setTimeout(r, 350));
  return { stats: mockStats, activity: mockActivity };
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: fetchDashboard });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">
          Welcome back, {user?.username?.split('.')[0] ?? 'developer'}
        </h1>
        <p className="text-sm text-text-muted mt-1">Here's what's happening across your vault.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[104px]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Notes" value={data!.stats.notes} icon={FiFileText} sub="12 pinned" />
          <StatCard label="Snippets" value={data!.stats.snippets} icon={FiCode} sub="8 languages" />
          <StatCard label="Active projects" value={data!.stats.activeProjects} icon={FiFolder} />
          <StatCard
            label="Pending tasks"
            value={data!.stats.pendingTasks}
            icon={FiCheckSquare}
            sub="3 due this week"
          />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <WeeklyChart />
          <div className="card p-5 space-y-4">
            <h3 className="font-display font-semibold text-sm">Usage</h3>
            {isLoading ? (
              <Skeleton className="h-12" />
            ) : (
              <div className="space-y-4">
                <StorageGauge
                  label="Storage"
                  used={data!.stats.storageUsedGB}
                  limit={data!.stats.storageLimitGB}
                  unit="GB"
                />
                <StorageGauge
                  label="API calls today"
                  used={data!.stats.apiCallsToday}
                  limit={data!.stats.apiCallsLimit}
                  unit=""
                />
              </div>
            )}
          </div>
        </div>
        <div>
          {isLoading ? <Skeleton className="h-72" /> : <ActivityFeed items={data!.activity} />}
        </div>
      </div>
    </div>
  );
}
