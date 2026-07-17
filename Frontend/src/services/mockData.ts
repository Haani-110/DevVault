import type { Note, Project, Task, ActivityItem, DashboardStats, User } from '@/types';

export const mockUser: User = {
  id: 'usr_01',
  email: 'ayah@devvault.io',
  username: 'ayah.dev',
  avatarUrl: undefined,
  bio: 'Full-stack developer. Building things that break gracefully.',
  role: 'DEVELOPER',
  createdAt: '2025-01-14T09:00:00Z',
};

export const mockStats: DashboardStats = {
  notes: 128,
  snippets: 64,
  activeProjects: 6,
  pendingTasks: 17,
  storageUsedGB: 3.2,
  storageLimitGB: 10,
  apiCallsToday: 842,
  apiCallsLimit: 5000,
};

export const mockActivity: ActivityItem[] = [
  {
    id: 'a1',
    type: 'task',
    message: 'Moved "Refresh token rotation" to In Review',
    timestamp: '2026-07-16T08:12:00Z',
  },
  {
    id: 'a2',
    type: 'note',
    message: 'Pinned note "Postgres index cheatsheet"',
    timestamp: '2026-07-16T07:40:00Z',
  },
  {
    id: 'a3',
    type: 'project',
    message: 'Created project "DevVault Mobile"',
    timestamp: '2026-07-15T19:05:00Z',
  },
  {
    id: 'a4',
    type: 'snippet',
    message: 'Saved snippet "Prisma pagination helper"',
    timestamp: '2026-07-15T16:22:00Z',
  },
  {
    id: 'a5',
    type: 'auth',
    message: 'Signed in from a new device',
    timestamp: '2026-07-15T08:01:00Z',
  },
];

export const mockNotes: Note[] = [
  {
    id: 'note_1',
    title: 'Postgres index cheatsheet',
    content: '## B-Tree vs GIN\n\nUse GIN for JSONB and array containment queries...',
    tags: ['database', 'reference'],
    isPinned: true,
    isFavorite: true,
    isArchived: false,
    updatedAt: '2026-07-16T07:40:00Z',
    createdAt: '2026-06-01T10:00:00Z',
  },
  {
    id: 'note_2',
    title: 'JWT refresh flow notes',
    content: 'Access token 15m, refresh token 7d, rotate on use, blacklist on logout.',
    tags: ['auth', 'security'],
    isPinned: true,
    isFavorite: false,
    isArchived: false,
    updatedAt: '2026-07-14T12:00:00Z',
    createdAt: '2026-05-20T10:00:00Z',
  },
  {
    id: 'note_3',
    title: 'Client onboarding checklist',
    content: '1. Kickoff call\n2. Access to repos\n3. Staging environment\n4. Weekly demo cadence',
    tags: ['process'],
    isPinned: false,
    isFavorite: true,
    isArchived: false,
    updatedAt: '2026-07-10T09:00:00Z',
    createdAt: '2026-04-11T10:00:00Z',
  },
  {
    id: 'note_4',
    title: 'Redis caching patterns',
    content: 'Cache-aside for read-heavy, write-through for consistency-critical paths.',
    tags: ['redis', 'performance'],
    isPinned: false,
    isFavorite: false,
    isArchived: false,
    updatedAt: '2026-07-08T09:00:00Z',
    createdAt: '2026-03-02T10:00:00Z',
  },
];

export const mockProjects: Project[] = [
  {
    id: 'proj_1',
    name: 'DevVault Core API',
    description: 'NestJS backend, auth & modules',
    color: '#E8A33D',
    taskCount: 24,
    completedCount: 15,
    updatedAt: '2026-07-16T06:00:00Z',
  },
  {
    id: 'proj_2',
    name: 'DevVault Mobile',
    description: 'React Native companion app',
    color: '#5EEAD4',
    taskCount: 12,
    completedCount: 3,
    updatedAt: '2026-07-15T19:05:00Z',
  },
  {
    id: 'proj_3',
    name: 'Client — Northwind SaaS',
    description: 'Freelance contract, billing module',
    color: '#F87171',
    taskCount: 9,
    completedCount: 6,
    updatedAt: '2026-07-13T09:00:00Z',
  },
];

export const mockTasks: Task[] = [
  {
    id: 't1',
    projectId: 'proj_1',
    title: 'Design Prisma schema for API collections',
    status: 'DONE',
    priority: 'HIGH',
  },
  {
    id: 't2',
    projectId: 'proj_1',
    title: 'Implement refresh token rotation',
    status: 'IN_REVIEW',
    priority: 'URGENT',
    dueDate: '2026-07-18',
  },
  {
    id: 't3',
    projectId: 'proj_1',
    title: 'Add rate limiting middleware',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    dueDate: '2026-07-20',
  },
  {
    id: 't4',
    projectId: 'proj_1',
    title: 'Write Swagger docs for Notes module',
    status: 'BACKLOG',
    priority: 'LOW',
  },
  {
    id: 't5',
    projectId: 'proj_1',
    title: 'Set up Winston structured logging',
    status: 'BACKLOG',
    priority: 'MEDIUM',
  },
  {
    id: 't6',
    projectId: 'proj_1',
    title: 'Configure Redis session store',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    dueDate: '2026-07-19',
  },
  {
    id: 't7',
    projectId: 'proj_1',
    title: 'Harden Helmet + CORS config',
    status: 'DONE',
    priority: 'MEDIUM',
  },
];
