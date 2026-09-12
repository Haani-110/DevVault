import { Injectable, HttpStatus } from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'node:crypto';
import { env, frontendUrls } from '../config/env';
import { ApiException } from '../common/errors/api-exception';
import { ErrorCode } from '../common/errors/error-codes';
import { TokenCryptoService } from '../common/security/token-crypto.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { UsersService } from '../users/users.service';
import type { OAuthProfile } from './strategies/google.strategy';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

interface TokenPayload {
  sub: string;
  email: string;
  role: string;
}

/** bcrypt cost. 10 ≈ 60–100 ms on commodity hardware — painful for an attacker, fine for a login. */
const BCRYPT_ROUNDS = 10;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * Sessions are two stateless JWTs (short access + long refresh, separate
 * secrets). Nothing here can revoke a token by id — there is no token store —
 * so the one revocation mechanism is `User.passwordChangedAt`: the JWT strategy
 * and `refresh` refuse any token issued before that instant. That is what makes
 * "change password" mean "signed out everywhere" without a session table, with
 * one documented imprecision: `iat` is second-granular, so a token minted in
 * the same second as the change is still accepted (see `assertSessionStillValid`).
 */
@Injectable()
export class AuthService {
  private readonly accessSecret = env.jwt.accessSecret;
  private readonly refreshSecret = env.jwt.refreshSecret;
  private readonly accessExpiresIn = env.jwt.accessExpiresIn as JwtSignOptions['expiresIn'];
  private readonly refreshExpiresIn = env.jwt.refreshExpiresIn as JwtSignOptions['expiresIn'];

  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly tokenCrypto: TokenCryptoService,
  ) {}

  async register(dto: RegisterDto) {
    const emailExists = await this.usersService.findByEmail(dto.email);
    if (emailExists) {
      throw new ApiException(HttpStatus.CONFLICT, ErrorCode.EMAIL_ALREADY_REGISTERED, 'Email already registered');
    }

    const usernameExists = await this.usersService.findByUsername(dto.username);
    if (usernameExists) {
      throw new ApiException(HttpStatus.CONFLICT, ErrorCode.USERNAME_ALREADY_TAKEN, 'Username already taken');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.usersService.create({
      email: dto.email,
      username: dto.username,
      passwordHash,
    });

    const tokens = this.generateTokens(user.id, user.email, user.role);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  /**
   * A wrong email and a wrong password get the exact same response on purpose:
   * `Invalid credentials`. Telling a caller "no such account" is a free user
   * enumeration endpoint, and the password field would then only slow them
   * down on accounts that exist.
   */
  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.passwordHash) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_CREDENTIALS, 'Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_CREDENTIALS, 'Invalid credentials');
    }

    const tokens = this.generateTokens(user.id, user.email, user.role);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async refresh(refreshToken: string) {
    let payload: TokenPayload & { iat?: number };
    try {
      payload = this.jwtService.verify<TokenPayload & { iat?: number }>(refreshToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.INVALID_REFRESH_TOKEN,
        'Invalid or expired refresh token',
      );
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_REFRESH_TOKEN, 'Invalid or expired refresh token');
    }
    this.assertSessionStillValid(user.passwordChangedAt, payload.iat);

    // This is a re-issue, not a rotation: with no token store there is nothing
    // to mark the presented token as spent, so it stays usable until its own
    // `exp`. Calling it "rotation" here would be a claim this file cannot keep.
    // What *is* enforced is `passwordChangedAt` above — that is the revocation
    // mechanism this app actually has.
    return this.generateTokens(user.id, user.email, user.role);
  }

  /** Same response either way — see the note on `login` about enumeration. */
  async forgotPassword(dto: ForgotPasswordDto) {
    const genericMessage = 'If that email exists, a reset link is on its way.';
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) return { message: genericMessage };

    // One link in flight at a time: any earlier unused token is burned.
    await this.prisma.passwordReset.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    const token = crypto.randomBytes(32).toString('hex');
    await this.prisma.passwordReset.create({
      data: { userId: user.id, token, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
    });

    const resetUrl = `${frontendUrls[0]}/reset-password?token=${token}`;

    // A mail server outage must not turn into a 500 that tells the caller the
    // address is valid, and must not lose the reset link either — so failures
    // are logged (EmailService logs the URL in dev) and the answer stays flat.
    try {
      await this.emailService.sendPasswordReset({ to: user.email, username: user.username, resetUrl });
    } catch {
      // Intentionally not rethrown; see the comment above.
    }

    return { message: genericMessage };
  }

  /**
   * Sign-in for a provider profile. Resolution order matters:
   * (provider, providerUid) → existing user by email (accounts that predate
   * the OAuth link) → brand-new user. Step 2 is what lets someone who signed up
   * with a password later "continue with GitHub" and land on the same vault.
   */
  async findOrCreateOAuthUser(profile: OAuthProfile) {
    const existingOAuth = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerUid: { provider: profile.provider, providerUid: profile.providerUid },
      },
      include: { user: true },
    });

    if (existingOAuth) {
      await this.prisma.oAuthAccount.update({
        where: { id: existingOAuth.id },
        data: this.encryptedTokenFields(profile),
      });
      const u = existingOAuth.user;
      return this.generateTokens(u.id, u.email, u.role);
    }

    let user = await this.usersService.findByEmail(profile.email);

    if (!user) {
      user = await this.usersService.createOAuthUser({
        email: profile.email,
        username: await this.deriveUsername(profile),
        avatarUrl: profile.avatarUrl,
      });
    }

    await this.prisma.oAuthAccount.create({
      data: {
        userId: user.id,
        provider: profile.provider,
        providerUid: profile.providerUid,
        ...this.encryptedTokenFields(profile),
      },
    });

    return this.generateTokens(user.id, user.email, user.role);
  }

  /**
   * Signs a short-lived token identifying "this specific logged-in user wants
   * to connect a provider", carried through the OAuth redirect as `state`.
   * Separate from access/refresh tokens so it can't be reused as a session
   * token if it leaked, and it expires quickly since it's only needed for the
   * few seconds of the OAuth round trip. It also doubles as CSRF protection for
   * the callback: a provider response without a matching state is ignored.
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
   * Attaches an OAuth provider to an ALREADY-KNOWN user (from an active session)
   * instead of resolving the user by matching email the way sign-in does. This is
   * what makes "connect GitHub" safe for someone who signed up with Google/password
   * using a different email than their GitHub account — see auth.controller.ts.
   */
  async linkOAuthAccount(userId: string, profile: OAuthProfile) {
    const existing = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerUid: { provider: profile.provider, providerUid: profile.providerUid },
      },
    });

    if (existing) {
      if (existing.userId !== userId) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          ErrorCode.OAUTH_ACCOUNT_LINKED_ELSEWHERE,
          `This ${profile.provider} account is already linked to a different DevVault account.`,
        );
      }
      await this.prisma.oAuthAccount.update({
        where: { id: existing.id },
        data: this.encryptedTokenFields(profile),
      });
      return;
    }

    await this.prisma.oAuthAccount.create({
      data: {
        userId,
        provider: profile.provider,
        providerUid: profile.providerUid,
        ...this.encryptedTokenFields(profile),
      },
    });
  }

  /** Decrypts a stored provider token for server-side use. Never exposed over HTTP. */
  async getProviderAccessToken(userId: string, provider: 'github' | 'google'): Promise<string | null> {
    const account = await this.prisma.oAuthAccount.findFirst({
      where: { userId, provider },
      select: { accessToken: true },
    });
    if (!account?.accessToken) return null;
    return this.tokenCrypto.decrypt(account.accessToken);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ApiException(HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED, 'Not authenticated');

    if (!user.passwordHash) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.SOCIAL_ONLY_ACCOUNT,
        'This account uses social login and has no password to change.',
      );
    }
    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.PASSWORD_MISMATCH, 'Current password is incorrect');

    if (dto.currentPassword === dto.newPassword) {
      throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.PASSWORD_MISMATCH, 'New password must differ from the current one');
    }

    await this.setPassword(userId, dto.newPassword);
    return { message: 'Password changed successfully. Other devices will need to sign in again.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const record = await this.prisma.passwordReset.findUnique({
      where: { token: dto.token },
      include: { user: true },
    });

    if (!record) throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.INVALID_RESET_TOKEN, 'Invalid or expired reset token');
    if (record.used) throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.RESET_TOKEN_USED, 'This reset link has already been used');
    if (record.expiresAt < new Date()) throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.RESET_TOKEN_EXPIRED, 'Reset link has expired');

    // Consume the token first (`used` flip is the single-use guard), then set the
    // password, in one transaction so a failed password write can't leave a
    // spent-but-useless token behind.
    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash, passwordChangedAt: new Date() },
      }),
      this.prisma.passwordReset.update({ where: { id: record.id }, data: { used: true } }),
    ]);

    return { message: 'Password updated successfully. You can now sign in.' };
  }

  private async setPassword(userId: string, newPassword: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS), passwordChangedAt: new Date() },
    });
  }

  /**
   * Rejects a token that was signed before the account's password last changed.
   * `iat` is in whole seconds, so the comparison floors to the same granularity:
   * a token issued in the same second as the change survives it (otherwise a
   * user's own session would be cut off for changing their password a
   * millisecond after signing in), and the cost is that revocation is only
   * precise to about a second.
   */
  private assertSessionStillValid(passwordChangedAt: Date | null | undefined, issuedAtSeconds: number | undefined) {
    if (!passwordChangedAt || !issuedAtSeconds) return;
    if (issuedAtSeconds * 1000 < Math.floor(passwordChangedAt.getTime() / 1000) * 1000) {
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.UNAUTHORIZED,
        'This session is no longer valid. Please sign in again.',
      );
    }
  }

  /** Same check the JWT guard needs on every request; shared so both agree. */
  assertSessionIssuedAfterPasswordChange(user: { passwordChangedAt: Date | null }, issuedAtSeconds?: number) {
    this.assertSessionStillValid(user.passwordChangedAt, issuedAtSeconds);
  }

  private async deriveUsername(profile: OAuthProfile): Promise<string> {
    const base =
      profile.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 20) ||
      profile.email.split('@')[0].replace(/[^a-z0-9]/g, '').slice(0, 20) ||
      'user';

    let username = base;
    for (let attempt = 1; await this.usersService.findByUsername(username); attempt++) {
      username = `${base}${attempt}`;
    }
    return username;
  }

  /** Provider tokens are encrypted at rest when a key is configured (see TokenCryptoService). */
  private encryptedTokenFields(profile: OAuthProfile) {
    return {
      accessToken: this.tokenCrypto.encrypt(profile.accessToken),
      refreshToken: this.tokenCrypto.encrypt(profile.refreshToken),
    };
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

  /** The public shape of a user. `passwordHash` never appears here, by construction. */
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
