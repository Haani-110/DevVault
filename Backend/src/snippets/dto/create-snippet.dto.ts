import { ArrayMaxSize, IsArray, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MAX_TAG_LENGTH, MAX_TAGS } from '../../notes/dto/create-note.dto';

export class CreateSnippetDto {
  @ApiProperty({ example: 'JWT Auth middleware' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiProperty({ example: 'Reusable JWT guard for NestJS', required: false })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'const x = 1;' })
  @IsString()
  @MinLength(1)
  @MaxLength(100_000)
  code: string;

  // A short lowercase identifier — it is used as a Monaco/Prism language key
  // and rendered in the UI, so arbitrary text here is both meaningless and unsafe.
  @ApiProperty({ example: 'typescript', required: false })
  @IsString()
  @Matches(/^[a-z0-9+#.-]{1,30}$/)
  @IsOptional()
  language?: string;

  @ApiProperty({ example: ['auth', 'nestjs'], type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @MaxLength(MAX_TAG_LENGTH, { each: true })
  @ArrayMaxSize(MAX_TAGS)
  @IsOptional()
  tags?: string[];
}
