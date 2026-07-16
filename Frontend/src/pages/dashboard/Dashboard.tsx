import { useQuery } from '@tanstack/react-query';
import { FiFileText, FiCode, FiFolder, FiCheckSquare } from 'react-icons/fi';
import StatCard from '@/components/dashboard/StatCard';
import ActivityFeed from '@/components/dashboard/ActivityFeed';
import StorageGauge from '@/components/dashboard/StorageGauge';
import WeeklyChart from '@/components/dashboard/WeeklyChart';
import Skeleton from '@/components/ui/Skeleton';
import { mockActivity } from '@/services/mockData';
import { dashboardService } from '@/services/dashboardService';
import { useAuth } from '@/hooks/useAuth';

export default function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardService.getStats(),
  });

  const pendingTasks = data ? data.totalTasks - data.completedTasks : 0;
  const storageUsedGB = data ? +(data.storageUsed / 1024).toFixed(2) : 0;
  const storageLimitGB = data ? +(data.storageLimit / 1024).toFixed(0) : 5;

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
          <StatCard label="Notes" value={data?.totalNotes ?? 0} icon={FiFileText} />
          <StatCard label="Snippets" value={0} icon={FiCode} sub="Coming soon" />
          <StatCard label="Active projects" value={data?.totalProjects ?? 0} icon={FiFolder} />
          <StatCard
            label="Pending tasks"
            value={pendingTasks}
            icon={FiCheckSquare}
          />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <WeeklyChart weeklyActivity={data?.weeklyActivity ?? []} />
          <div className="card p-5 space-y-4">
            <h3 className="font-display font-semibold text-sm">Usage</h3>
            {isLoading ? (
              <Skeleton className="h-12" />
            ) : (
              <div className="space-y-4">
                <StorageGauge
                  label="Storage"
                  used={storageUsedGB}
                  limit={storageLimitGB}
                  unit="GB"
                />
                <StorageGauge
                  label="API calls today"
                  used={0}
                  limit={5000}
                  unit=""
                />
              </div>
            )}
          </div>
        </div>
        <div>
          {isLoading ? <Skeleton className="h-72" /> : <ActivityFeed items={mockActivity} />}
        </div>
      </div>
    </div>
  );
}
