import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { requireOwnedProject } from '../common/authz/ownership';
import { ApiException } from '../common/errors/api-exception';
import { ErrorCode } from '../common/errors/error-codes';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

/**
 * Every method takes the authenticated `userId` and scopes its query with it —
 * see `common/authz/ownership.ts` for why the ownership check lives inside the
 * query rather than in an `if` afterwards.
 */
@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Task counters the UI needs on every project; computed in one query. */
  private static readonly include = {
    _count: { select: { tasks: true } },
    tasks: { select: { status: true } },
  } satisfies Prisma.ProjectInclude;

  private static shape(project: {
    id: string;
    name: string;
    description: string | null;
    color: string;
    sourceRepo: string | null;
    updatedAt: Date;
    _count: { tasks: number };
    tasks: { status: string }[];
  }) {
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      color: project.color,
      sourceRepo: project.sourceRepo,
      taskCount: project._count.tasks,
      completedCount: project.tasks.filter((t) => t.status === 'DONE').length,
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  async list(userId: string) {
    const projects = await this.prisma.project.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: ProjectsService.include,
    });
    return projects.map((p) => ProjectsService.shape(p));
  }

  async findOne(userId: string, projectId: string) {
    // findFirst (not findUnique) so `userId` is part of the lookup: someone
    // else's project must be indistinguishable from no project at all.
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
      include: ProjectsService.include,
    });
    if (!project) {
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.PROJECT_NOT_FOUND, 'Project not found');
    }
    return ProjectsService.shape(project);
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
      sourceRepo: project.sourceRepo,
      taskCount: 0,
      completedCount: 0,
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  async update(userId: string, projectId: string, dto: UpdateProjectDto) {
    await requireOwnedProject(this.prisma, userId, projectId);

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.color !== undefined && { color: dto.color }),
      },
      include: ProjectsService.include,
    });
    return ProjectsService.shape(updated);
  }

  /**
   * `deleteMany` with the owner in the where clause instead of "check, then
   * delete": the ownership test and the mutation are one statement, so there
   * is no window in which the row could change hands.
   */
  async remove(userId: string, projectId: string) {
    const { count } = await this.prisma.project.deleteMany({ where: { id: projectId, userId } });
    if (count === 0) {
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.PROJECT_NOT_FOUND, 'Project not found');
    }
  }
}
