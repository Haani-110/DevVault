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
import { SnippetsService } from './snippets.service';
import { CreateSnippetDto } from './dto/create-snippet.dto';
import { UpdateSnippetDto } from './dto/update-snippet.dto';

interface AuthUser {
  userId: string;
  email: string;
  role: string;
}

@ApiTags('snippets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('snippets')
export class SnippetsController {
  constructor(private readonly snippetsService: SnippetsService) {}

  @Get()
  @ApiOperation({ summary: 'List all snippets for the current user, optionally filtered by project' })
  @ApiQuery({ name: 'projectId', required: false, description: 'Filter to one project. Pass an empty string to see only snippets with no project.' })
  list(@CurrentUser() user: AuthUser, @Query('projectId') projectId?: string) {
    return this.snippetsService.list(user.userId, projectId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new snippet' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSnippetDto) {
    return this.snippetsService.create(user.userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a snippet' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateSnippetDto,
  ) {
    return this.snippetsService.update(user.userId, id, dto);
  }

  @Patch(':id/favorite')
  @ApiOperation({ summary: 'Toggle favorite status of a snippet' })
  toggleFavorite(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.snippetsService.toggleFavorite(user.userId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a snippet' })
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.snippetsService.remove(user.userId, id);
  }
}
