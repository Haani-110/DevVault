import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Tag caps keep a note from becoming a 10,000-tag payload; notes/snippets share the limit. */
export const MAX_TAGS = 20;
export const MAX_TAG_LENGTH = 40;

export class CreateNoteDto {
  @ApiProperty({ example: 'My First Note' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiProperty({ example: '# Hello\n\nThis is my note.' })
  @IsString()
  @MaxLength(100_000)
  content: string;

  @ApiProperty({ example: ['typescript', 'backend'], type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @MaxLength(MAX_TAG_LENGTH, { each: true })
  @ArrayMaxSize(MAX_TAGS)
  @IsOptional()
  tags?: string[];
}
