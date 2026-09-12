import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * The avatar is uploaded as a data URL (the frontend resizes it client-side),
 * which is why `avatarUrl` allows `data:` while the link fields insist on a
 * real http(s) URL — a stray `javascript:` or `data:text/html` in a profile
 * field becomes a stored-XSS payload the moment another page renders it.
 */
export class UpdateProfileDto {
  @ApiProperty({ required: false, example: 'ayah.dev' })
  @IsString()
  @MaxLength(30)
  @IsOptional()
  username?: string;

  @ApiProperty({ required: false })
  @IsString()
  @MaxLength(300)
  @IsOptional()
  bio?: string;

  @ApiProperty({ required: false })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  location?: string;

  @ApiProperty({ required: false, example: 'https://aya.dev' })
  @IsUrl({ require_tld: false, protocols: ['https', 'http'] })
  @MaxLength(200)
  @IsOptional()
  website?: string;

  @ApiProperty({ required: false, example: 'https://github.com/octocat' })
  @IsUrl({ require_tld: false, protocols: ['https', 'http'], host_whitelist: ['github.com', 'www.github.com'] })
  @MaxLength(200)
  @IsOptional()
  githubUrl?: string;

  @ApiProperty({ required: false })
  @IsUrl({ require_tld: false, protocols: ['https', 'http'] })
  @MaxLength(200)
  @IsOptional()
  linkedinUrl?: string;

  @ApiProperty({ required: false })
  @IsUrl({ require_tld: false, protocols: ['https', 'http', 'data'] })
  @MaxLength(2_000_000)
  @IsOptional()
  avatarUrl?: string;
}
