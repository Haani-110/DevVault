import { api } from '@/lib/axios';
import type { Project, Task, TaskStatus } from '@/types';

export interface CreateProjectPayload {
  name: string;
  description?: string;
  color?: string;
}

export interface UpdateProjectPayload {
  name?: string;
  description?: string;
  color?: string;
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status?: 'BACKLOG' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
  dueDate?: string;
}

export const projectsService = {
  async list(): Promise<Project[]> {
    const { data } = await api.get('/projects');
    return data;
  },

  async create(payload: CreateProjectPayload): Promise<Project> {
    const { data } = await api.post('/projects', payload);
    return data;
  },

  async update(id: string, payload: UpdateProjectPayload): Promise<Project> {
    const { data } = await api.patch(`/projects/${id}`, payload);
    return data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/projects/${id}`);
  },

  async listTasks(projectId: string): Promise<Task[]> {
    const { data } = await api.get(`/projects/${projectId}/tasks`);
    return data;
  },

  async createTask(projectId: string, payload: CreateTaskPayload): Promise<Task> {
    const { data } = await api.post(`/tasks/project/${projectId}`, payload);
    return data;
  },

  async moveTask(taskId: string, status: TaskStatus): Promise<void> {
    await api.patch(`/tasks/${taskId}`, { status });
  },

  async deleteTask(taskId: string): Promise<void> {
    await api.delete(`/tasks/${taskId}`);
  },
};
