import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MoveTaskDto } from './dto/move-task.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async listByProject(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.userId !== userId) throw new ForbiddenException();

    return this.prisma.task.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async move(userId: string, taskId: string, dto: MoveTaskDto) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');

    const project = await this.prisma.project.findUnique({
      where: { id: task.projectId },
    });
    if (!project || project.userId !== userId) throw new ForbiddenException();

    await this.prisma.task.update({
      where: { id: taskId },
      data: { status: dto.status as TaskStatus },
    });
  }

  async create(
    userId: string,
    projectId: string,
    data: {
      title: string;
      description?: string;
      priority?: string;
      dueDate?: string;
    },
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.userId !== userId) throw new ForbiddenException();

    return this.prisma.task.create({
      data: {
        projectId,
        userId,
        title: data.title,
        description: data.description,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
    });
  }
}
