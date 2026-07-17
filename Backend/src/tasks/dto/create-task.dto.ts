import { IsString, IsOptional, IsEnum, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum TaskPriorityEnum {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum TaskStatusEnum {
  BACKLOG = 'BACKLOG',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  DONE = 'DONE',
}

export class CreateTaskDto {
  @ApiProperty({ example: 'Implement login page' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiProperty({ example: 'Build the login form with validation', required: false })
  @IsString()
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

  @ApiProperty({ example: '2025-12-31', required: false })
  @IsString()
  @IsOptional()
  dueDate?: string;
}
