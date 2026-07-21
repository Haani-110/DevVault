import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ImportRepoDto {
  @ApiProperty({ example: 'Haani-110' })
  @IsString()
  @MinLength(1)
  owner: string;

  @ApiProperty({ example: 'DevVault' })
  @IsString()
  @MinLength(1)
  repo: string;

  @ApiProperty({ example: 'main', required: false, description: 'Defaults to the repo\'s default branch if omitted' })
  @IsString()
  branch?: string;
}
