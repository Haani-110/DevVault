import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';

class UpdateProfileDto {
  @IsString()
  @IsOptional()
  @MaxLength(40)
  username?: string;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  bio?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  location?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  website?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  githubUrl?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  linkedinUrl?: string;
}

interface AuthUser {
  userId: string;
  email: string;
  role: string;
}

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  getMe(@CurrentUser() user: AuthUser) {
    return this.usersService.findById(user.userId);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update profile' })
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.userId, dto);
  }

  @Delete('account')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Permanently delete account and all data' })
  async deleteAccount(@CurrentUser() user: AuthUser) {
    await this.usersService.deleteAccount(user.userId);
  }
}
