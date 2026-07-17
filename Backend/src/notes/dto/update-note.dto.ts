import { IsString, IsArray, IsOptional, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateNoteDto {
  @ApiProperty({ example: 'Updated Title', required: false })
  @IsString()
  @MinLength(1)
  @IsOptional()
  title?: string;

  @ApiProperty({ example: '# Updated content', required: false })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiProperty({ example: ['typescript', 'backend'], type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}
