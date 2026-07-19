import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface UpdateProfileDto {
  username?: string;
  bio?: string;
  location?: string;
  website?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  avatarUrl?: string;
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
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        bio: true,
        avatarUrl: true,
        location: true,
        website: true,
        githubUrl: true,
        linkedinUrl: true,
        role: true,
        createdAt: true,
      },
    });
  }

  create(data: { email: string; username: string; passwordHash: string }) {
    return this.prisma.user.create({ data });
  }

  createOAuthUser(data: { email: string; username: string; avatarUrl?: string }) {
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
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.website !== undefined && { website: dto.website }),
        ...(dto.githubUrl !== undefined && { githubUrl: dto.githubUrl }),
        ...(dto.linkedinUrl !== undefined && { linkedinUrl: dto.linkedinUrl }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
      },
      select: {
        id: true,
        email: true,
        username: true,
        bio: true,
        avatarUrl: true,
        location: true,
        website: true,
        githubUrl: true,
        linkedinUrl: true,
        role: true,
        createdAt: true,
      },
    });
    return user;
  }

  async deleteAccount(userId: string) {
    await this.prisma.user.delete({ where: { id: userId } });
  }
}
