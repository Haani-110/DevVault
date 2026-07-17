import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface UpdateProfileDto {
  username?: string;
  bio?: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  create(data: { email: string; username: string; passwordHash: string }) {
    return this.prisma.user.create({ data });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.username) {
      const existing = await this.prisma.user.findUnique({ where: { username: dto.username } });
      if (existing && existing.id !== userId) {
        throw new ConflictException('Username already taken');
      }
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.username && { username: dto.username }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
      },
    });
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  async deleteAccount(userId: string) {
    await this.prisma.user.delete({ where: { id: userId } });
  }
}
