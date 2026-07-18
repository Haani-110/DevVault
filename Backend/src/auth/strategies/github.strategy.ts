import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-github2';
import type { OAuthProfile } from './google.strategy';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor() {
    super({
      clientID: process.env.GITHUB_CLIENT_ID ?? 'GITHUB_CLIENT_ID_NOT_SET',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? 'GITHUB_CLIENT_SECRET_NOT_SET',
      callbackURL:
        process.env.GITHUB_CALLBACK_URL ??
        'http://localhost:4000/api/v1/auth/github/callback',
      scope: ['user:email'],
    });
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (err: Error | null, user?: OAuthProfile) => void,
  ): void {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      done(new Error('No public email on this GitHub account. Please add a public email in your GitHub settings.'));
      return;
    }
    const user: OAuthProfile = {
      provider: 'github',
      providerUid: String(profile.id),
      email,
      name: profile.displayName || (profile as unknown as { username: string }).username || email.split('@')[0],
      avatarUrl: profile.photos?.[0]?.value,
      accessToken,
      refreshToken,
    };
    done(null, user);
  }
}
