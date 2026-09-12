import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { handleOAuthFailure } from './oauth-redirect.guard';

/**
 * The `github` passport strategy for route guards, plus a browser-friendly
 * failure path. See `oauth-redirect.guard.ts` for why a rejected provider round
 * trip must not surface as a 500 page — and why this is one guard per provider
 * rather than one configurable class: `AuthGuard(strategy)` bakes the strategy
 * name into the mixin it returns.
 */
@Injectable()
export class GithubAuthGuard extends AuthGuard('github') {
  handleRequest<TUser = any>(
    err: Error | null,
    user: TUser | false,
    info: unknown,
    context: ExecutionContext,
  ): TUser {
    return handleOAuthFailure<TUser>('GitHub', err, user, info, context);
  }
}
