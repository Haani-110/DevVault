import { HttpStatus, Injectable } from '@nestjs/common';
import { TaskPriority, TaskStatus } from '@prisma/client';
import { requireOwnedProject, requireOwnedTask } from '../common/authz/ownership';
import { ApiException } from '../common/errors/api-exception';
import { ErrorCode } from '../common/errors/error-codes';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';

/**
 * A task is reachable through its project, so both halves are checked: the
 * project must belong to the caller, and the task must belong to that project.
 * See `common/authz/ownership.ts`.
 */
@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async listByProject(userId: string, projectId: string) {
    await requireOwnedProject(this.prisma, userId, projectId);

    return this.prisma.task.findMany({
      where: { projectId, userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * `projectId` comes from the URL, so it is exactly the field an attacker
   * would swap. Requiring the project to be the caller's before inserting
   * stops notes/tasks from being planted in someone else's board.
   */
  async create(userId: string, projectId: string, dto: CreateTaskDto) {
    await requireOwnedProject(this.prisma, userId, projectId);

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
    const task = await requireOwnedTask(this.prisma, userId, taskId);
    if (task.status === dto.status) return;

    await this.prisma.task.update({
      where: { id: taskId },
      data: { status: dto.status as TaskStatus },
    });
  }

  async remove(userId: string, taskId: string) {
    const { count } = await this.prisma.task.deleteMany({ where: { id: taskId, userId } });
    if (count === 0) {
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.TASK_NOT_FOUND, 'Task not found');
    }
  }
}
