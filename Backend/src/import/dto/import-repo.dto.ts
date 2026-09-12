import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * `owner`/`repo` are interpolated into a GitHub API path
 * (`/repos/{owner}/{repo}/git/trees/{branch}`), so they are validated as GitHub
 * slug characters and nothing else — no `/`, `?`, `#` or `@`, which would let a
 * request reach a different endpoint or append query parameters than the one
 * this service intends to call.
 */
const GITHUB_SLUG = /^[A-Za-z0-9._-]{1,100}$/;
const GIT_REF = /^[A-Za-z0-9._-]{1,100}$/;

export class ImportRepoDto {
  @ApiProperty({ example: 'Haani-110' })
  @IsString()
  @Matches(GITHUB_SLUG, { message: 'owner must be a GitHub user or organization name' })
  owner: string;

  @ApiProperty({ example: 'DevVault' })
  @IsString()
  @Matches(GITHUB_SLUG, { message: 'repo must be a GitHub repository name' })
  repo: string;

  @ApiProperty({ example: 'main', required: false, description: "Defaults to the repo's default branch if omitted" })
  @IsString()
  @Matches(GIT_REF, { message: 'branch must be a plain git ref name' })
  @MaxLength(100)
  @IsOptional()
  branch?: string;
}
