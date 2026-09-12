import { HttpStatus, Injectable } from '@nestjs/common';
import { ApiException } from '../common/errors/api-exception';
import { ErrorCode } from '../common/errors/error-codes';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { UpdateProfileDto } from './dto/update-profile.dto';

/**
 * Profile reads/writes for the authenticated user only — every method takes a
 * `userId` that came from the JWT and has no way to name someone else.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The profile a client is allowed to see. One list, used by every endpoint
   * that returns a user, so "the shape of a user" cannot drift between
   * `GET /users/me` and `PATCH /users/profile` the way it had.
   */
  private static readonly profileSelect = {
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
    // Which providers can sign this account in — Settings renders this as
    // "Connected" next to Google/GitHub.
    oauthAccounts: { select: { provider: true } },
  } satisfies Prisma.UserSelect;

  /**
   * What the auth layer needs, which is the profile *plus* the one field no
   * response may carry: `passwordChangedAt`, read by the JWT strategy and
   * `AuthService.refresh` to reject sessions minted before the last change.
   * Keeping it in a separate select is what stops "I needed it once" from
   * turning into "every endpoint returns it".
   */
  private static readonly authSelect = {
    ...UsersService.profileSelect,
    passwordChangedAt: true,
  } satisfies Prisma.UserSelect;

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  /** For the auth layer only — the result carries `passwordChangedAt`. */
  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: UsersService.authSelect,
    });
  }

  /** The shape `GET /users/me` returns: no `passwordChangedAt`, no hashes. */
  getProfile(id: string) {
    return this.prisma.user.findUnique({ where: { id }, select: UsersService.profileSelect });
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
        // ApiException, not ConflictException, so the response carries a
        // machine-readable `code` like every other error this API returns.
        throw new ApiException(HttpStatus.CONFLICT, ErrorCode.USERNAME_ALREADY_TAKEN, 'That username is already taken');
      }
    }

    // `where: { id: userId }` — the id in the JWT is the only one this can touch.
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.username !== undefined && { username: dto.username }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.website !== undefined && { website: dto.website }),
        ...(dto.githubUrl !== undefined && { githubUrl: dto.githubUrl }),
        ...(dto.linkedinUrl !== undefined && { linkedinUrl: dto.linkedinUrl }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
      },
      select: UsersService.profileSelect,
    });
  }

  /**
   * Cascades through Notes/Snippets/Projects/ImportJobs/OAuthAccount via the
   * schema's `onDelete: Cascade`. Tasks point at users with `RESTRICT`, so they
   * are removed with their projects first — deleting them separately here would
   * race that cascade.
   */
  deleteAccount(userId: string) {
    return this.prisma.user.delete({ where: { id: userId } });
  }
}
