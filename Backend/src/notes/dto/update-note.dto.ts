import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MAX_TAG_LENGTH, MAX_TAGS } from './create-note.dto';

export class UpdateNoteDto {
  @ApiProperty({ example: 'Updated Title', required: false })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @IsOptional()
  title?: string;

  @ApiProperty({ example: '# Updated content', required: false })
  @IsString()
  @MaxLength(100_000)
  @IsOptional()
  content?: string;

  @ApiProperty({ example: ['typescript', 'backend'], type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @MaxLength(MAX_TAG_LENGTH, { each: true })
  @ArrayMaxSize(MAX_TAGS)
  @IsOptional()
  tags?: string[];
}
