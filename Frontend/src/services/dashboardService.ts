import { api } from '@/lib/axios';

export interface WeeklyDataPoint {
  day: string;
  notes: number;
  tasks: number;
  snippets: number;
}

export interface RecentActivityItem {
  id: string;
  type: 'note' | 'task' | 'snippet' | 'project' | 'auth';
  message: string;
  timestamp: string;
}

export interface RecentNote {
  id: string;
  title: string;
  updatedAt: string;
}

export interface DashboardApiResponse {
  totalNotes: number;
  totalProjects: number;
  totalSnippets: number;
  totalTasks: number;
  completedTasks: number;
  storageUsed: number;
  storageLimit: number;
  weeklyActivity: WeeklyDataPoint[];
  recentActivity: RecentActivityItem[];
  recentNotes: RecentNote[];
}

export const dashboardService = {
  async getStats(): Promise<DashboardApiResponse> {
    const { data } = await api.get('/dashboard/stats');
    return data;
  },
};
