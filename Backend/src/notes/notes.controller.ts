import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ParseIdPipe } from '../common/pipes/parse-id.pipe';
import { NotesService } from './notes.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { ListNotesQueryDto } from './dto/list-notes-query.dto';

interface AuthUser {
  userId: string;
  email: string;
  role: string;
}

@ApiTags('notes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  @ApiOperation({ summary: 'List notes for the current user, optionally filtered by project and/or archived state' })
  @ApiQuery({ name: 'projectId', required: false, description: 'Filter to one project. Pass an empty string to see only notes with no project.' })
  @ApiQuery({ name: 'archived', required: false, description: 'true for archived notes only, false (default) for active ones' })
  list(@CurrentUser() user: AuthUser, @Query() query?: ListNotesQueryDto) {
    return this.notesService.list(user.userId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new note' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateNoteDto) {
    return this.notesService.create(user.userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update note content, title or tags' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: UpdateNoteDto,
  ) {
    return this.notesService.update(user.userId, id, dto);
  }

  @Patch(':id/pin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Toggle pin status of a note' })
  async togglePin(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string) {
    await this.notesService.togglePin(user.userId, id);
  }

  @Patch(':id/favorite')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Toggle favorite status of a note' })
  async toggleFavorite(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string) {
    await this.notesService.toggleFavorite(user.userId, id);
  }

  @Patch(':id/archive')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Toggle archive status of a note' })
  async toggleArchive(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string) {
    await this.notesService.toggleArchive(user.userId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a note' })
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string) {
    await this.notesService.remove(user.userId, id);
  }
}
