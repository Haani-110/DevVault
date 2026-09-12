import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @MaxLength(254)
  // Emails are stored lowercase, so "A@x.com" and "a@x.com" cannot become two
  // accounts that differ only by capitalization.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;

  @ApiProperty({ example: 'johndoe' })
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  // Anything else (spaces, emoji, `<`, `"`) breaks the mention-style UI and
  // makes "who is this?" ambiguous once a username is rendered in a URL or heading.
  @Matches(/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/i, {
    message:
      'username may contain only letters, numbers, dots, dashes and underscores, and must start and end with a letter or number',
  })
  username: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  // Matches the frontend's rule. Accepting 6 here while the form asked for 8
  // just meant the API was the weak door.
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128, { message: 'Password must be at most 128 characters' })
  password: string;
}
