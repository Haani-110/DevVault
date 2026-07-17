import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(userId: string) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [
      totalNotes,
      totalProjects,
      totalSnippets,
      taskStats,
      recentNotes,
      recentTasks,
      recentSnippets,
    ] = await Promise.all([
      this.prisma.note.count({ where: { userId, isArchived: false } }),
      this.prisma.project.count({ where: { userId } }),
      this.prisma.snippet.count({ where: { userId } }),
      this.prisma.task.groupBy({
        by: ['status'],
        where: { userId },
        _count: { id: true },
      }),
      this.prisma.note.findMany({
        where: { userId, createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.task.findMany({
        where: { userId, createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.snippet.findMany({
        where: { userId, createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const totalTasks = taskStats.reduce((sum, s) => sum + s._count.id, 0);
    const completedTasks =
      taskStats.find((s) => s.status === 'DONE')?._count.id ?? 0;

    // Build weekly activity with separate notes/tasks/snippets counts per day
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const orderedDays: string[] = [];
    const noteMap = new Map<string, number>();
    const taskMap = new Map<string, number>();
    const snippetMap = new Map<string, number>();

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = days[d.getDay()];
      orderedDays.push(label);
      noteMap.set(label, 0);
      taskMap.set(label, 0);
      snippetMap.set(label, 0);
    }

    recentNotes.forEach(({ createdAt }) => {
      const label = days[createdAt.getDay()];
      if (noteMap.has(label)) noteMap.set(label, (noteMap.get(label) ?? 0) + 1);
    });
    recentTasks.forEach(({ createdAt }) => {
      const label = days[createdAt.getDay()];
      if (taskMap.has(label)) taskMap.set(label, (taskMap.get(label) ?? 0) + 1);
    });
    recentSnippets.forEach(({ createdAt }) => {
      const label = days[createdAt.getDay()];
      if (snippetMap.has(label)) snippetMap.set(label, (snippetMap.get(label) ?? 0) + 1);
    });

    const weeklyActivity = orderedDays.map((day) => ({
      day,
      notes: noteMap.get(day) ?? 0,
      tasks: taskMap.get(day) ?? 0,
      snippets: snippetMap.get(day) ?? 0,
    }));

    // Recent activity feed — merge notes, tasks, snippets sorted by date
    const [latestNotes, latestTasks, latestSnippets] = await Promise.all([
      this.prisma.note.findMany({
        where: { userId },
        select: { id: true, title: true, createdAt: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
      this.prisma.task.findMany({
        where: { userId },
        select: { id: true, title: true, status: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
      this.prisma.snippet.findMany({
        where: { userId },
        select: { id: true, title: true, language: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
    ]);

    const activityItems = [
      ...latestNotes.map((n) => ({
        id: `note-${n.id}`,
        type: 'note' as const,
        message: `Note "${n.title}"`,
        timestamp: n.updatedAt.toISOString(),
      })),
      ...latestTasks.map((t) => ({
        id: `task-${t.id}`,
        type: 'task' as const,
        message: `Task "${t.title}" — ${t.status.replace('_', ' ').toLowerCase()}`,
        timestamp: t.updatedAt.toISOString(),
      })),
      ...latestSnippets.map((s) => ({
        id: `snippet-${s.id}`,
        type: 'snippet' as const,
        message: `Snippet "${s.title}" (${s.language})`,
        timestamp: s.updatedAt.toISOString(),
      })),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 8);

    return {
      totalNotes,
      totalProjects,
      totalSnippets,
      totalTasks,
      completedTasks,
      storageUsed: 0,
      storageLimit: 5120,
      weeklyActivity,
      recentActivity: activityItems,
    };
  }
}
