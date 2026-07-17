import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const projects = await this.prisma.project.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { tasks: true } },
        tasks: { select: { status: true } },
      },
    });

    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      color: p.color,
      taskCount: p._count.tasks,
      completedCount: p.tasks.filter((t) => t.status === 'DONE').length,
      updatedAt: p.updatedAt.toISOString(),
    }));
  }

  async findOne(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        _count: { select: { tasks: true } },
        tasks: { select: { status: true } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.userId !== userId) throw new ForbiddenException();

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      color: project.color,
      taskCount: project._count.tasks,
      completedCount: project.tasks.filter((t) => t.status === 'DONE').length,
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  async create(userId: string, dto: CreateProjectDto) {
    const project = await this.prisma.project.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
        color: dto.color ?? '#6366f1',
      },
    });
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      color: project.color,
      taskCount: 0,
      completedCount: 0,
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  async update(userId: string, projectId: string, dto: UpdateProjectDto) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.userId !== userId) throw new ForbiddenException();

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.color !== undefined && { color: dto.color }),
      },
      include: {
        _count: { select: { tasks: true } },
        tasks: { select: { status: true } },
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      color: updated.color,
      taskCount: updated._count.tasks,
      completedCount: updated.tasks.filter((t) => t.status === 'DONE').length,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async remove(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.userId !== userId) throw new ForbiddenException();

    await this.prisma.project.delete({ where: { id: projectId } });
  }
}
