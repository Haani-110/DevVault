import { mockProjects, mockTasks } from './mockData';
import type { Project, Task, TaskStatus } from '@/types';

const USE_MOCK = false;
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
let tasks = [...mockTasks];

export const projectsService = {
  async list(): Promise<Project[]> {
    if (USE_MOCK) {
      await delay(350);
      return [...mockProjects];
    }
    const { api } = await import('@/lib/axios');
    const { data } = await api.get('/projects');
    return data;
  },

  async listTasks(projectId: string): Promise<Task[]> {
    if (USE_MOCK) {
      await delay(300);
      return tasks.filter((t) => t.projectId === projectId);
    }
    const { api } = await import('@/lib/axios');
    const { data } = await api.get(`/projects/${projectId}/tasks`);
    return data;
  },

  async moveTask(taskId: string, status: TaskStatus): Promise<void> {
    if (USE_MOCK) {
      await delay(150);
      tasks = tasks.map((t) => (t.id === taskId ? { ...t, status } : t));
      return;
    }
    const { api } = await import('@/lib/axios');
    await api.patch(`/tasks/${taskId}`, { status });
  },
};
