import { IsEnum, IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TaskPriorityEnum, TaskStatusEnum } from './task-enums';

export class CreateTaskDto {
  @ApiProperty({ example: 'Implement login page' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiProperty({ example: 'Build the login form with validation', required: false })
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: TaskPriorityEnum, required: false })
  @IsEnum(TaskPriorityEnum)
  @IsOptional()
  priority?: TaskPriorityEnum;

  @ApiProperty({ enum: TaskStatusEnum, required: false })
  @IsEnum(TaskStatusEnum)
  @IsOptional()
  status?: TaskStatusEnum;

  // Date-only or full ISO 8601 — the Kanban "Add task" control sends `YYYY-MM-DD`
  // from a date input, and `new Date('nonsense')` would otherwise become a
  // 500 from Prisma rather than a 400 from validation.
  @ApiProperty({ example: '2025-12-31', required: false })
  @IsISO8601({ strict: true })
  @IsOptional()
  dueDate?: string;

  @ApiProperty({ required: false })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  assignee?: string;
}
