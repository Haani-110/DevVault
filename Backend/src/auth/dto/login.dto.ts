import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;

  // Only the *shape* is validated here. The length is not the security control
  // at login (bcrypt compares whatever it is given), and refusing short strings
  // would lock out accounts created before registration required 8 characters.
  @ApiProperty({ example: 'password123', minLength: 1 })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}
