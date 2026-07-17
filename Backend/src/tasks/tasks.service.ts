import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { TaskStatus, TaskPriority } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MoveTaskDto } from './dto/move-task.dto';
import { CreateTaskDto } from './dto/create-task.dto';

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

  async create(userId: string, projectId: string, dto: CreateTaskDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.userId !== userId) throw new ForbiddenException();

    return this.prisma.task.create({
      data: {
        projectId,
        userId,
        title: dto.title,
        description: dto.description,
        priority: (dto.priority as TaskPriority) ?? TaskPriority.MEDIUM,
        status: (dto.status as TaskStatus) ?? TaskStatus.BACKLOG,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
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

  async remove(userId: string, taskId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');

    const project = await this.prisma.project.findUnique({
      where: { id: task.projectId },
    });
    if (!project || project.userId !== userId) throw new ForbiddenException();

    await this.prisma.task.delete({ where: { id: taskId } });
  }
}
