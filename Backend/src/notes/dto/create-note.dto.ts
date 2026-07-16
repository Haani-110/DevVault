import { IsString, IsArray, IsOptional, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateNoteDto {
  @ApiProperty({ example: 'My First Note' })
  @IsString()
  @MinLength(1)
  title: string;

  @ApiProperty({ example: '# Hello\n\nThis is my note.' })
  @IsString()
  content: string;

  @ApiProperty({ example: ['typescript', 'backend'], type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}
