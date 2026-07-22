import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
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
  @ApiOperation({
    summary:
      'Start importing a GitHub repository in the background (AI-analyzed notes/snippets). ' +
      'Returns immediately with a jobId — poll GET /import/github/status/:jobId for progress, ' +
      'since a real import can take a few minutes and is not held open as one long request.',
  })
  startImport(@CurrentUser() user: AuthUser, @Body() dto: ImportRepoDto) {
    return this.importService.startImport(user.userId, dto);
  }

  @Get('status/:jobId')
  @ApiOperation({ summary: 'Poll the status/progress of a running or finished import job' })
  getStatus(@CurrentUser() user: AuthUser, @Param('jobId') jobId: string) {
    return this.importService.getJobStatus(user.userId, jobId);
  }
}
