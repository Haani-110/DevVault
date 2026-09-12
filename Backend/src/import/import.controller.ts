import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ParseIdPipe } from '../common/pipes/parse-id.pipe';
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
  @HttpCode(HttpStatus.ACCEPTED)
  // One POST per import is the whole point; the 409 for a job already running
  // is cheap, but a loop of them would burn both GitHub and Groq budgets.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Start importing a GitHub repository in the background (AI-analyzed notes/snippets/tasks). ' +
      'Returns 202 with a jobId — poll GET /import/github/jobs/:jobId, since a real import runs ' +
      'for minutes and is not held open as one long request.',
  })
  startImport(@CurrentUser() user: AuthUser, @Body() dto: ImportRepoDto) {
    return this.importService.startImport(user.userId, dto);
  }

  @Get('jobs/latest')
  @ApiOperation({
    summary:
      "The caller's most recent import job, or { job: null }. Lets the UI resume " +
      'progress after a reload or after navigating away.',
  })
  async getLatestJob(@CurrentUser() user: AuthUser) {
    // Wrapped in an object on purpose: a bare `null` body reaches axios as `{}`,
    // and `if (job)` would then be true with no job at all.
    return { job: await this.importService.getLatestJob(user.userId) };
  }

  @Get('jobs/:jobId')
  @ApiOperation({ summary: 'Poll the status/progress of a running or finished import job' })
  getStatus(@CurrentUser() user: AuthUser, @Param('jobId', ParseIdPipe) jobId: string) {
    return this.importService.getJobStatus(user.userId, jobId);
  }
}
