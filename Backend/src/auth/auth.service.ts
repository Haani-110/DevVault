import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

interface TokenPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class AuthService {
  private readonly accessSecret =
    process.env.JWT_ACCESS_SECRET ?? 'devvault-access-secret-change-in-production';
  private readonly refreshSecret =
    process.env.JWT_REFRESH_SECRET ?? 'devvault-refresh-secret-change-in-production';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly accessExpiresIn: any = process.env.JWT_ACCESS_EXPIRES_IN ?? '15m';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly refreshExpiresIn: any = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';

  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  async register(dto: RegisterDto) {
    const emailExists = await this.usersService.findByEmail(dto.email);
    if (emailExists) throw new ConflictException('Email already registered');

    const usernameExists = await this.usersService.findByUsername(dto.username);
    if (usernameExists) throw new ConflictException('Username already taken');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create({
      email: dto.email,
      username: dto.username,
      passwordHash,
    });

    const tokens = this.generateTokens(user.id, user.email, user.role);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    if (!user.passwordHash) throw new UnauthorizedException('This account uses social login. Please sign in with Google or GitHub.');
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const tokens = this.generateTokens(user.id, user.email, user.role);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<TokenPayload>(refreshToken, {
        secret: this.refreshSecret,
      });
      const user = await this.usersService.findById(payload.sub);
      if (!user) throw new UnauthorizedException();
      return this.generateTokens(user.id, user.email, user.role);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    // Always return success to prevent email enumeration
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) return { message: 'If that email exists, a reset link is on its way.' };

    // Invalidate any existing unused tokens for this user
    await this.prisma.passwordReset.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    // Generate a cryptographically secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.passwordReset.create({
      data: { userId: user.id, token, expiresAt },
    });

    // Build the reset URL
    const frontendUrl =
      process.env.FRONTEND_URL || "http://localhost:5173"

    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    await this.emailService.sendPasswordReset({
      to: user.email,
      username: user.username,
      resetUrl,
    });

    return { message: 'If that email exists, a reset link is on its way.' };
  }

  async findOrCreateOAuthUser(profile: {
    provider: string;
    providerUid: string;
    email: string;
    name: string;
    avatarUrl?: string;
    accessToken?: string;
    refreshToken?: string;
  }) {
    // 1. Check if this exact OAuth account already exists
    const existingOAuth = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerUid: {
          provider: profile.provider,
          providerUid: profile.providerUid,
        },
      },
      include: { user: true },
    });

    if (existingOAuth) {
      // Refresh stored tokens
      await this.prisma.oAuthAccount.update({
        where: { id: existingOAuth.id },
        data: { accessToken: profile.accessToken, refreshToken: profile.refreshToken },
      });
      const u = existingOAuth.user;
      return this.generateTokens(u.id, u.email, u.role);
    }

    // 2. Check if a user with this email already exists (email+password account)
    let user = await this.usersService.findByEmail(profile.email);

    if (!user) {
      // 3. New user — derive a unique username
      const base = profile.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 20) || profile.email.split('@')[0].replace(/[^a-z0-9]/g, '').slice(0, 20) || 'user';

      let username = base;
      let attempt = 0;
      while (await this.usersService.findByUsername(username)) {
        attempt++;
        username = `${base}${attempt}`;
      }

      user = await this.usersService.createOAuthUser({
        email: profile.email,
        username,
        avatarUrl: profile.avatarUrl,
      });
    }

    // 4. Link the OAuth account to this user
    await this.prisma.oAuthAccount.create({
      data: {
        userId: user.id,
        provider: profile.provider,
        providerUid: profile.providerUid,
        accessToken: profile.accessToken,
        refreshToken: profile.refreshToken,
      },
    });

    return this.generateTokens(user.id, user.email, user.role);
  }

  /**
   * Signs a short-lived token identifying "this specific logged-in user wants
   * to connect a provider," carried through the OAuth redirect as `state`.
   * Separate from access/refresh tokens so it can't be reused as a session
   * token if it leaked, and expires quickly since it's only needed for the
   * few seconds of the OAuth round trip.
   */
  createLinkState(userId: string): string {
    return this.jwtService.sign(
      { sub: userId, purpose: 'link-provider' },
      { secret: this.accessSecret, expiresIn: '10m' },
    );
  }

  /** Returns the userId if `state` is a valid, unexpired link token — otherwise null (never throws). */
  verifyLinkState(state: string | undefined): string | null {
    if (!state) return null;
    try {
      const payload = this.jwtService.verify<{ sub: string; purpose: string }>(state, {
        secret: this.accessSecret,
      });
      return payload.purpose === 'link-provider' ? payload.sub : null;
    } catch {
      return null;
    }
  }

  /**
   * Attaches an OAuth provider to an ALREADY-KNOWN user (from an active session),
   * instead of resolving the user by matching email the way sign-in does. This is
   * what makes "connect GitHub" safe for someone who signed up with Google/password
   * using a different email than their GitHub account — see auth.controller.ts.
   */
  async linkOAuthAccount(
    userId: string,
    profile: {
      provider: string;
      providerUid: string;
      accessToken?: string;
      refreshToken?: string;
    },
  ) {
    const existing = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerUid: {
          provider: profile.provider,
          providerUid: profile.providerUid,
        },
      },
    });

    if (existing) {
      if (existing.userId !== userId) {
        throw new ConflictException(
          `This ${profile.provider} account is already linked to a different DevVault account.`,
        );
      }
      // Already linked to this same user — just refresh the stored tokens.
      await this.prisma.oAuthAccount.update({
        where: { id: existing.id },
        data: { accessToken: profile.accessToken, refreshToken: profile.refreshToken },
      });
      return;
    }

    await this.prisma.oAuthAccount.create({
      data: {
        userId,
        provider: profile.provider,
        providerUid: profile.providerUid,
        accessToken: profile.accessToken,
        refreshToken: profile.refreshToken,
      },
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    if (!user.passwordHash) throw new BadRequestException('This account uses social login and has no password to change.');
    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    if (dto.currentPassword === dto.newPassword)
      throw new BadRequestException('New password must differ from the current one');

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    return { message: 'Password changed successfully.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const record = await this.prisma.passwordReset.findUnique({
      where: { token: dto.token },
      include: { user: true },
    });

    if (!record) throw new BadRequestException('Invalid or expired reset token');
    if (record.used) throw new BadRequestException('This reset link has already been used');
    if (record.expiresAt < new Date()) throw new BadRequestException('Reset link has expired');

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    // Update password and mark token used atomically
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordReset.update({
        where: { id: record.id },
        data: { used: true },
      }),
    ]);

    return { message: 'Password updated successfully. You can now sign in.' };
  }

  private generateTokens(userId: string, email: string, role: string) {
    const payload: TokenPayload = { sub: userId, email, role };
    const accessToken = this.jwtService.sign(payload, {
      secret: this.accessSecret,
      expiresIn: this.accessExpiresIn,
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.refreshSecret,
      expiresIn: this.refreshExpiresIn,
    });
    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: {
    id: string;
    email: string;
    username: string;
    avatarUrl: string | null;
    bio: string | null;
    role: string;
    createdAt: Date;
  }) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      avatarUrl: user.avatarUrl ?? undefined,
      bio: user.bio ?? undefined,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
