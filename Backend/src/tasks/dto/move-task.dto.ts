import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum TaskStatusEnum {
  BACKLOG = 'BACKLOG',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  DONE = 'DONE',
}

export class MoveTaskDto {
  @ApiProperty({ enum: TaskStatusEnum })
  @IsEnum(TaskStatusEnum)
  status: TaskStatusEnum;
}
