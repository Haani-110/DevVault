import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';

export interface OAuthProfile {
  provider: string;
  providerUid: string;
  email: string;
  name: string;
  avatarUrl?: string;
  accessToken?: string;
  refreshToken?: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID ?? 'GOOGLE_CLIENT_ID_NOT_SET',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? 'GOOGLE_CLIENT_SECRET_NOT_SET',
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ??
        'http://localhost:4000/api/v1/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      done(new Error('No email returned from Google'), undefined);
      return;
    }
    const user: OAuthProfile = {
      provider: 'google',
      providerUid: profile.id,
      email,
      name: profile.displayName || email.split('@')[0],
      avatarUrl: profile.photos?.[0]?.value,
      accessToken,
      refreshToken,
    };
    done(null, user);
  }
}
