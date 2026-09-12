import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-github2';
import { env } from '../../config/env';
import type { OAuthProfile } from './google.strategy';

/**
 * Two entry points share this config: the Passport guard (normal "sign in with
 * GitHub") and `GET /auth/github/link-url`, which has to produce the same
 * authorize URL but with a `state` claim tying it to the logged-in user.
 * Building it in one place is what keeps those two from drifting apart.
 */
export function buildGithubAuthorizeUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id: env.github.clientId,
    redirect_uri: env.github.callbackUrl,
    // The env value is already the space-separated string this URL wants.
    scope: env.github.scope,
  });
  if (state) params.set('state', state);
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor() {
    super({
      clientID: env.github.clientId,
      clientSecret: env.github.clientSecret,
      callbackURL: env.github.callbackUrl,
      // 'repo' is needed so imported private repos can be read for the AI import
      // feature. Narrow to ['user:email', 'public_repo'] to import public repos only.
      // passport-github2 types `scope` as string[] (it joins with spaces for the
      // authorize URL), so the space-separated env value is split here rather
      // than smuggled through a cast.
      scope: env.github.scope.split(' '),
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
      done(new Error('No public email on this GitHub account. Add a public email in your GitHub settings and try again.'));
      return;
    }
    const user: OAuthProfile = {
      provider: 'github',
      providerUid: String(profile.id),
      email,
      name: profile.displayName || (profile as unknown as { username?: string }).username || email.split('@')[0],
      avatarUrl: profile.photos?.[0]?.value,
      accessToken,
      refreshToken,
    };
    done(null, user);
  }
}
