import { IsString, IsArray, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSnippetDto {
  @ApiProperty({ example: 'JWT Auth middleware' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiProperty({ example: 'Reusable JWT guard for NestJS', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'const x = 1;' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'typescript', required: false })
  @IsString()
  @IsOptional()
  language?: string;

  @ApiProperty({ example: ['auth', 'nestjs'], type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}
