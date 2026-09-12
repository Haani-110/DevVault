import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { env } from '../../config/env';
import { UsersService } from '../../users/users.service';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  /** Seconds since epoch, added by `jwt.sign`. Used for the password-change check. */
  iat?: number;
}

/**
 * Authentication only — it answers "who is this?", never "may they have this
 * row?". Every service additionally scopes its query by the `userId` found
 * here (see `common/authz/ownership.ts`).
 *
 * The user is re-read on each request rather than trusting the token's claims.
 * That costs one indexed lookup and buys two things: a deleted account stops
 * working immediately, and a password change invalidates older access tokens
 * before their 15 minutes are up.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.jwt.accessSecret,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub);
    if (!user) throw new UnauthorizedException();

    if (user.passwordChangedAt && (payload.iat ?? 0) * 1000 < Math.floor(user.passwordChangedAt.getTime() / 1000) * 1000) {
      throw new UnauthorizedException('This session is no longer valid. Please sign in again.');
    }

    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}
