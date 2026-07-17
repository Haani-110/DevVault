import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSnippetDto } from './dto/create-snippet.dto';
import { UpdateSnippetDto } from './dto/update-snippet.dto';

@Injectable()
export class SnippetsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.snippet.findMany({
      where: { userId },
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
    const snippet = await this.prisma.snippet.findUnique({ where: { id: snippetId } });
    if (!snippet) throw new NotFoundException('Snippet not found');
    if (snippet.userId !== userId) throw new ForbiddenException();

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
    const snippet = await this.prisma.snippet.findUnique({ where: { id: snippetId } });
    if (!snippet) throw new NotFoundException('Snippet not found');
    if (snippet.userId !== userId) throw new ForbiddenException();

    return this.prisma.snippet.update({
      where: { id: snippetId },
      data: { isFavorite: !snippet.isFavorite },
    });
  }

  async remove(userId: string, snippetId: string) {
    const snippet = await this.prisma.snippet.findUnique({ where: { id: snippetId } });
    if (!snippet) throw new NotFoundException('Snippet not found');
    if (snippet.userId !== userId) throw new ForbiddenException();

    await this.prisma.snippet.delete({ where: { id: snippetId } });
  }
}
