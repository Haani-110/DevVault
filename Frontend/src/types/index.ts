export type Role = 'ADMIN' | 'DEVELOPER' | 'GUEST';

export interface User {
  id: string;
  email: string;
  username: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  website?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  role: Role;
  createdAt: string;
  oauthAccounts?: { provider: string }[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  isPinned: boolean;
  isFavorite: boolean;
  isArchived: boolean;
  updatedAt: string;
  createdAt: string;
}

export type TaskStatus = 'BACKLOG' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  assignee?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  color: string;
  taskCount: number;
  completedCount: number;
  updatedAt: string;
}

export interface Snippet {
  id: string;
  title: string;
  description?: string;
  code: string;
  language: string;
  tags: string[];
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityItem {
  id: string;
  type: 'note' | 'task' | 'project' | 'snippet' | 'auth';
  message: string;
  timestamp: string;
}

export interface DashboardStats {
  notes: number;
  snippets: number;
  activeProjects: number;
  pendingTasks: number;
  storageUsedGB: number;
  storageLimitGB: number;
  apiCallsToday: number;
  apiCallsLimit: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
