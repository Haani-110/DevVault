import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty({ example: 'My Project' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'Project description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: '#6366f1', required: false })
  @IsString()
  @IsOptional()
  color?: string;
}
