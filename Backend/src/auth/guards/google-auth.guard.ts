import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { handleOAuthFailure } from './oauth-redirect.guard';

/** The `google` passport strategy for route guards. See `github-auth.guard.ts`. */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  handleRequest<TUser = any>(
    err: Error | null,
    user: TUser | false,
    info: unknown,
    context: ExecutionContext,
  ): TUser {
    return handleOAuthFailure<TUser>('Google', err, user, info, context);
  }
}
