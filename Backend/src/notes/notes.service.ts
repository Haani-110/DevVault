import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNoteDto } from './dto/create-note.dto';

@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.note.findMany({
      where: { userId, isArchived: false },
      orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
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

  async togglePin(userId: string, noteId: string) {
    const note = await this.prisma.note.findUnique({ where: { id: noteId } });
    if (!note) throw new NotFoundException('Note not found');
    if (note.userId !== userId) throw new ForbiddenException();

    await this.prisma.note.update({
      where: { id: noteId },
      data: { isPinned: !note.isPinned },
    });
  }

  async remove(userId: string, noteId: string) {
    const note = await this.prisma.note.findUnique({ where: { id: noteId } });
    if (!note) throw new NotFoundException('Note not found');
    if (note.userId !== userId) throw new ForbiddenException();

    await this.prisma.note.delete({ where: { id: noteId } });
  }
}
