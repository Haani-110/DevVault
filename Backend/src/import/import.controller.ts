import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ImportService } from './import.service';
import { ImportRepoDto } from './dto/import-repo.dto';

interface AuthUser {
  userId: string;
  email: string;
  role: string;
}

@ApiTags('import')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('import/github')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Get('repos')
  @ApiOperation({ summary: "List the current user's importable GitHub repositories" })
  listRepos(@CurrentUser() user: AuthUser) {
    return this.importService.listRepos(user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Import a GitHub repository: analyze it with AI and create a Project with generated Notes/Snippets' })
  importRepo(@CurrentUser() user: AuthUser, @Body() dto: ImportRepoDto) {
    return this.importService.importRepo(user.userId, dto);
  }
}
