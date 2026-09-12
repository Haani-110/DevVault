import { ExecutionContext, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { frontendUrls } from '../../config/env';

/**
 * Shared failure handling for the "sign in with Google/GitHub" guards.
 *
 * Passport's default behaviour when a provider rejects the attempt — no public
 * email on the GitHub account, a stale token, or the user simply clicking
 * "Cancel" on the consent screen — is to fail the request with a 500 whose body
 * is the provider's raw error text, rendered as a page in the middle of the
 * browser. A redirect-driven flow needs a redirect-driven failure path, so this
 * sends the browser back to the sign-in screen with a readable reason instead.
 *
 * It resolves (instead of throwing) after redirecting, so nothing else writes to
 * an already-ended response; the callback routes pair this with a
 * `res.headersSent` check for the same reason.
 *
 * This is a plain function rather than a base class because
 * `AuthGuard(strategy)` bakes the strategy name into the mixin it returns — a
 * shared subclass could not pass it up through `super()`.
 */
const logger = new Logger('OAuth');

export function handleOAuthFailure<TUser>(
  providerName: string,
  err: Error | null,
  user: TUser | false,
  info: unknown,
  context: ExecutionContext,
): TUser {
  const failure = err ?? (user ? null : info ?? new Error('The provider rejected the sign-in attempt.'));
  // Nothing went wrong and we have a user: that's the success path, hand it to
  // the route (`req.user`).
  if (!failure && user) return user;

  const reason = describeFailure(failure);
  logger.warn(`${providerName} OAuth failed: ${reason}`);

  const res = context.switchToHttp().getResponse<Response>();
  if (!res.headersSent) {
    res.redirect(`${frontendUrls[0]}/login?oauthError=${encodeURIComponent(reason)}`);
  }

  // Resolving with no user, so `canActivate` succeeds and the redirect above is
  // the whole response — throwing here would make Nest write its own error JSON
  // on top of a response that has already been sent.
  return undefined as unknown as TUser;
}

/**
 * Passport hands back a bare string, an `Error`, or `{ message }` depending on
 * where it failed. Keep it short, and never forward anything that could carry a
 * provider token or a raw upstream body.
 */
function describeFailure(failure: unknown): string {
  const raw =
    failure instanceof Error
      ? failure.message
      : typeof failure === 'string'
        ? failure
        : typeof (failure as { message?: unknown })?.message === 'string'
          ? (failure as { message: string }).message
          : '';

  const reason = raw.trim().slice(0, 200);
  return reason.length > 0 ? reason : 'The provider rejected the sign-in attempt.';
}
