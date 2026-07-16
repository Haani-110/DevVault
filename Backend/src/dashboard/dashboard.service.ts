import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(userId: string) {
    const [totalNotes, totalProjects, taskStats] = await Promise.all([
      this.prisma.note.count({ where: { userId, isArchived: false } }),
      this.prisma.project.count({ where: { userId } }),
      this.prisma.task.groupBy({
        by: ['status'],
        where: { userId },
        _count: { id: true },
      }),
    ]);

    const totalTasks = taskStats.reduce((sum, s) => sum + s._count.id, 0);
    const completedTasks =
      taskStats.find((s) => s.status === 'DONE')?._count.id ?? 0;

    // Weekly activity: count notes + tasks created in the last 7 days grouped by day
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [recentNotes, recentTasks] = await Promise.all([
      this.prisma.note.findMany({
        where: { userId, createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true },
      }),
      this.prisma.task.findMany({
        where: { userId, createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true },
      }),
    ]);

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyMap = new Map<string, number>();

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      weeklyMap.set(days[d.getDay()], 0);
    }

    [...recentNotes, ...recentTasks].forEach(({ createdAt }) => {
      const label = days[createdAt.getDay()];
      if (weeklyMap.has(label)) {
        weeklyMap.set(label, (weeklyMap.get(label) ?? 0) + 1);
      }
    });

    const weeklyActivity = Array.from(weeklyMap.entries()).map(([day, count]) => ({
      day,
      count,
    }));

    return {
      totalNotes,
      totalProjects,
      totalTasks,
      completedTasks,
      storageUsed: 0,
      storageLimit: 5120,
      weeklyActivity,
    };
  }
}
