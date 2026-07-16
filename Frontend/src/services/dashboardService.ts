const USE_MOCK = false;
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export interface DashboardApiResponse {
  totalNotes: number;
  totalProjects: number;
  totalTasks: number;
  completedTasks: number;
  storageUsed: number;   // MB
  storageLimit: number;  // MB
  weeklyActivity: { day: string; count: number }[];
}

export const dashboardService = {
  async getStats(): Promise<DashboardApiResponse> {
    if (USE_MOCK) {
      await delay(350);
      return {
        totalNotes: 0,
        totalProjects: 0,
        totalTasks: 0,
        completedTasks: 0,
        storageUsed: 0,
        storageLimit: 5120,
        weeklyActivity: [],
      };
    }
    const { api } = await import('@/lib/axios');
    const { data } = await api.get('/dashboard/stats');
    return data;
  },
};
