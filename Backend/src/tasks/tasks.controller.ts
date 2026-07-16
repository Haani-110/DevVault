import {
  Controller,
  Patch,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TasksService } from './tasks.service';
import { MoveTaskDto } from './dto/move-task.dto';

interface AuthUser {
  userId: string;
  email: string;
  role: string;
}

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Patch(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Update task status (move on Kanban)' })
  async move(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: MoveTaskDto,
  ) {
    await this.tasksService.move(user.userId, id, dto);
  }
}
