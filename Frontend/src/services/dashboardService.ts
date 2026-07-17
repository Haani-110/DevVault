import { api } from '@/lib/axios';

const USE_MOCK = false;
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export interface DashboardApiResponse {
  totalNotes: number;
  totalProjects: number;
  totalTasks: number;
  completedTasks: number;
  storageUsed: number;   // MB
  storageLimit: number;  // MB
  weeklyActivity: { day: string; notes: number; tasks: number }[];
  recentActivity: { id: string; type: string; label: string; time: string }[];
}

export const dashboardService = {
  async getStats(): Promise<DashboardApiResponse> {
    if (USE_MOCK) {
      await delay(500);
      return {
        totalNotes: 0,
        totalProjects: 0,
        totalTasks: 0,
        completedTasks: 0,
        storageUsed: 0,
        storageLimit: 5120,
        weeklyActivity: [],
        recentActivity: [],
      };
    }
    const { data } = await api.get('/dashboard/stats');
    return data;
  },
};
