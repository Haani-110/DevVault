import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProjectsService } from './projects.service';
import { TasksService } from '../tasks/tasks.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

interface AuthUser {
  userId: string;
  email: string;
  role: string;
}

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly tasksService: TasksService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all projects' })
  list(@CurrentUser() user: AuthUser) {
    return this.projectsService.list(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a project by ID' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.projectsService.findOne(user.userId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new project' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(user.userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a project' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a project and all its tasks' })
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.projectsService.remove(user.userId, id);
  }

  @Get(':id/tasks')
  @ApiOperation({ summary: 'List tasks for a project' })
  listTasks(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasksService.listByProject(user.userId, id);
  }
}
