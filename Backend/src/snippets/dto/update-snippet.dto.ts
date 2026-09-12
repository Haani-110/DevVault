import { ArrayMaxSize, IsArray, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MAX_TAG_LENGTH, MAX_TAGS } from '../../notes/dto/create-note.dto';

export class UpdateSnippetDto {
  @ApiProperty({ required: false })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @IsOptional()
  title?: string;

  @ApiProperty({ required: false })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsString()
  @MinLength(1)
  @MaxLength(100_000)
  @IsOptional()
  code?: string;

  @ApiProperty({ required: false })
  @IsString()
  @Matches(/^[a-z0-9+#.-]{1,30}$/)
  @IsOptional()
  language?: string;

  @ApiProperty({ type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @MaxLength(MAX_TAG_LENGTH, { each: true })
  @ArrayMaxSize(MAX_TAGS)
  @IsOptional()
  tags?: string[];
}
