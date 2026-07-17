import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotesService } from './notes.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';

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
  @ApiOperation({ summary: 'List all notes for the current user' })
  list(@CurrentUser() user: AuthUser) {
    return this.notesService.list(user.userId);
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
    @Param('id') id: string,
    @Body() dto: UpdateNoteDto,
  ) {
    return this.notesService.update(user.userId, id, dto);
  }

  @Patch(':id/pin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Toggle pin status of a note' })
  async togglePin(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.notesService.togglePin(user.userId, id);
  }

  @Patch(':id/favorite')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Toggle favorite status of a note' })
  async toggleFavorite(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.notesService.toggleFavorite(user.userId, id);
  }

  @Patch(':id/archive')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Toggle archive status of a note' })
  async toggleArchive(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.notesService.toggleArchive(user.userId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a note' })
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.notesService.remove(user.userId, id);
  }
}
