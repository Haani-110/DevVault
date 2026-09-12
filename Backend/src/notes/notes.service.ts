import { HttpStatus, Injectable } from '@nestjs/common';
import { requireOwnedNote } from '../common/authz/ownership';
import { ApiException } from '../common/errors/api-exception';
import { ErrorCode } from '../common/errors/error-codes';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';

/**
 * Reads are always filtered by `userId`; mutations either go through
 * `requireOwnedNote` or use `deleteMany`/`updateMany` with the owner in the
 * where clause. See `common/authz/ownership.ts`.
 */
@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  private static readonly listInclude = {
    project: { select: { id: true, name: true, color: true } },
  } as const;

  /**
   * `archived` selects which half of the notes to return instead of silently
   * hiding the other half: the Notes screen has an Archived tab, and it can
   * only work if the backend is willing to hand back archived rows at all.
   */
  list(userId: string, options: { projectId?: string; archived?: boolean } = {}) {
    const { projectId, archived = false } = options;
    return this.prisma.note.findMany({
      where: {
        userId,
        isArchived: archived,
        ...(projectId !== undefined && { projectId: projectId || null }),
      },
      include: NotesService.listInclude,
      orderBy: archived ? { updatedAt: 'desc' } : [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  create(userId: string, dto: CreateNoteDto) {
    return this.prisma.note.create({
      data: {
        userId,
        title: dto.title,
        content: dto.content,
        tags: dto.tags ?? [],
      },
    });
  }

  async update(userId: string, noteId: string, dto: UpdateNoteDto) {
    await requireOwnedNote(this.prisma, userId, noteId);

    return this.prisma.note.update({
      where: { id: noteId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
      },
    });
  }

  async togglePin(userId: string, noteId: string) {
    const note = await requireOwnedNote(this.prisma, userId, noteId);
    await this.prisma.note.update({ where: { id: noteId }, data: { isPinned: !note.isPinned } });
  }

  async toggleFavorite(userId: string, noteId: string) {
    const note = await requireOwnedNote(this.prisma, userId, noteId);
    await this.prisma.note.update({ where: { id: noteId }, data: { isFavorite: !note.isFavorite } });
  }

  async toggleArchive(userId: string, noteId: string) {
    const note = await requireOwnedNote(this.prisma, userId, noteId);
    await this.prisma.note.update({ where: { id: noteId }, data: { isArchived: !note.isArchived } });
  }

  /** One statement: the owner check *is* the delete condition. */
  async remove(userId: string, noteId: string) {
    const { count } = await this.prisma.note.deleteMany({ where: { id: noteId, userId } });
    if (count === 0) {
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.NOTE_NOT_FOUND, 'Note not found');
    }
  }
}
