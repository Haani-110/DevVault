import { HttpStatus, Injectable } from '@nestjs/common';
import { requireOwnedSnippet } from '../common/authz/ownership';
import { ApiException } from '../common/errors/api-exception';
import { ErrorCode } from '../common/errors/error-codes';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSnippetDto } from './dto/create-snippet.dto';
import { UpdateSnippetDto } from './dto/update-snippet.dto';

/** Authorization model is the same as NotesService — see common/authz/ownership.ts. */
@Injectable()
export class SnippetsService {
  constructor(private readonly prisma: PrismaService) {}

  private static readonly listInclude = {
    project: { select: { id: true, name: true, color: true } },
  } as const;

  list(userId: string, projectId?: string) {
    return this.prisma.snippet.findMany({
      where: {
        userId,
        ...(projectId !== undefined && { projectId: projectId || null }),
      },
      include: SnippetsService.listInclude,
      orderBy: [{ isFavorite: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  create(userId: string, dto: CreateSnippetDto) {
    return this.prisma.snippet.create({
      data: {
        userId,
        title: dto.title,
        description: dto.description,
        code: dto.code,
        language: dto.language ?? 'plaintext',
        tags: dto.tags ?? [],
      },
    });
  }

  async update(userId: string, snippetId: string, dto: UpdateSnippetDto) {
    await requireOwnedSnippet(this.prisma, userId, snippetId);

    return this.prisma.snippet.update({
      where: { id: snippetId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.language !== undefined && { language: dto.language }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
      },
    });
  }

  async toggleFavorite(userId: string, snippetId: string) {
    const snippet = await requireOwnedSnippet(this.prisma, userId, snippetId);
    return this.prisma.snippet.update({
      where: { id: snippetId },
      data: { isFavorite: !snippet.isFavorite },
    });
  }

  async remove(userId: string, snippetId: string) {
    const { count } = await this.prisma.snippet.deleteMany({ where: { id: snippetId, userId } });
    if (count === 0) {
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.SNIPPET_NOT_FOUND, 'Snippet not found');
    }
  }
}
