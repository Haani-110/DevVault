import { JwtService } from '@nestjs/jwt';
import { FakePrisma } from '../../test/fake-prisma';
import { expectApiError, observableFailure } from '../../test/helpers';
import { ErrorCode } from '../common/errors/error-codes';
import { TokenCryptoService } from '../common/security/token-crypto.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import type { OAuthProfile } from './strategies/google.strategy';

const ALICE = { email: 'alice@example.com', username: 'alice', password: 'correct horse battery' };
const PROFILE: OAuthProfile = {
  provider: 'github',
  providerUid: '12345',
  email: 'ada@example.com',
  name: 'Ada Lovelace',
  accessToken: 'ghp_plaintext_access_token',
  refreshToken: 'ghr_plaintext_refresh_token',
};

/**
 * Auth is the one module where a behaviour change is a security property, so
 * these specs test the rules — enumeration resistance, session invalidation,
 * single-use reset tokens, encrypted provider tokens — rather than re-drawing
 * the happy path.
 */
describe('AuthService', () => {
  let prisma: FakePrisma;
  let tokenCrypto: TokenCryptoService;
  let jwt: JwtService;
  let mailer: { sendPasswordReset: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    prisma = new FakePrisma();
    jwt = new JwtService({});
    mailer = { sendPasswordReset: jest.fn().mockResolvedValue(undefined) };
    tokenCrypto = new TokenCryptoService();
    service = new AuthService(new UsersService(prisma as never), prisma as never, jwt, mailer as never, tokenCrypto);
  });

  const register = () => service.register(ALICE);
  /**
   * A refresh token for `userId` with a chosen `iat`. Minting one is the only
   * way to test "issued before the password change" without sleeping a second
   * per run and still being sure which side of the boundary you are on.
   */
  const mintRefreshToken = (userId: string, claims: Record<string, unknown>) =>
    jwt.sign({ sub: userId, email: ALICE.email, role: 'USER', ...claims }, { secret: 'test-refresh-secret' });
  const userIdOf = (token: string) => (jwt.decode(token) as { sub: string }).sub;

  // ─── Registration ────────────────────────────────────────────────────────────

  it('stores a bcrypt hash instead of the password', async () => {
    await register();

    const stored = prisma.user.rows[0];
    expect(stored.passwordHash).not.toContain(ALICE.password);
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$\d{2}\$/);
  });

  it('returns a token pair and a profile with no secret fields', async () => {
    const { user, accessToken, refreshToken } = await register();

    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();
    expect(accessToken).not.toBe(refreshToken);
    expect(user).toMatchObject({ email: ALICE.email, username: ALICE.username });
    expect(user).not.toHaveProperty('passwordHash');
    expect(user).not.toHaveProperty('passwordChangedAt');
  });

  it('rejects a duplicate email or username with a machine-readable code', async () => {
    await register();

    await expectApiError(service.register({ ...ALICE, username: 'someone-else' }), 409, ErrorCode.EMAIL_ALREADY_REGISTERED);
    await expectApiError(service.register({ ...ALICE, email: 'other@example.com' }), 409, ErrorCode.USERNAME_ALREADY_TAKEN);
  });

  // ─── Login ───────────────────────────────────────────────────────────────────

  it('signs in with the right password', async () => {
    const { user } = await register();

    expect((await service.login({ email: ALICE.email, password: ALICE.password })).user.id).toBe(user.id);
  });

  it('gives one indistinguishable answer for a wrong password, an unknown address and a social-only account', async () => {
    await register();
    await service.findOrCreateOAuthUser({ ...PROFILE, email: 'social@example.com' });

    const failures = await Promise.all([
      service.login({ email: ALICE.email, password: 'nope' }).catch((e) => e),
      service.login({ email: 'nobody@example.com', password: ALICE.password }).catch((e) => e),
      service.login({ email: 'social@example.com', password: ALICE.password }).catch((e) => e),
    ]);

    for (const failure of failures) {
      expect(observableFailure(failure)).toEqual({
        statusCode: 401,
        code: ErrorCode.INVALID_CREDENTIALS,
        message: 'Invalid credentials',
      });
    }
  });

  // ─── Refresh and session invalidation ────────────────────────────────────────

  it('exchanges a valid refresh token for a working pair', async () => {
    const { refreshToken } = await register();
    const rotated = await service.refresh(refreshToken);

    expect(rotated.accessToken).toBeTruthy();
    expect(await service.refresh(rotated.refreshToken)).toHaveProperty('accessToken');
    // Documented limitation rather than an aspiration: with no token store,
    // refreshing does not invalidate the token it consumed.
    expect(await service.refresh(refreshToken)).toHaveProperty('accessToken');
  });

  it('refuses an access token presented as a refresh token (separate secrets)', async () => {
    const { accessToken } = await register();

    await expectApiError(service.refresh(accessToken), 401, ErrorCode.INVALID_REFRESH_TOKEN);
  });

  it('refuses a refresh token minted before the password last changed', async () => {
    const { user } = await register();
    const stale = mintRefreshToken(user.id, { iat: Math.floor(Date.now() / 1000) - 3600 });

    prisma.user.rows[0].passwordChangedAt = new Date();

    await expectApiError(service.refresh(stale), 401, ErrorCode.UNAUTHORIZED);
  });

  it('refuses a token whose account is gone', async () => {
    const { refreshToken } = await register();
    prisma.user.rows.length = 0;

    await expectApiError(service.refresh(refreshToken), 401, ErrorCode.INVALID_REFRESH_TOKEN);
  });

  it('refuses a malformed token without echoing why', async () => {
    const error = await service.refresh('not.a.jwt').catch((e) => e);

    expect(error.code).toBe(ErrorCode.INVALID_REFRESH_TOKEN);
    expect(error.message).not.toMatch(/jwt|signature|malformed/i);
  });

  // ─── Changing a password ─────────────────────────────────────────────────────

  it('requires the current password, and signs older sessions out when it is given', async () => {
    const { user, refreshToken } = await register();

    await expectApiError(
      service.changePassword(user.id, { currentPassword: 'wrong', newPassword: 'a brand new secret' }),
      400,
      ErrorCode.PASSWORD_MISMATCH,
    );

    await service.changePassword(user.id, { currentPassword: ALICE.password, newPassword: 'a brand new secret' });

    expect(await service.login({ email: ALICE.email, password: 'a brand new secret' })).toHaveProperty('accessToken');
    await expectApiError(service.login({ email: ALICE.email, password: ALICE.password }), 401, ErrorCode.INVALID_CREDENTIALS);
    // A session established *before* the change is now refused. Stated that way
    // on purpose: `refreshToken` was signed in the same second as the change, so
    // it is one of the sessions `iat`'s one-second granularity lets through —
    // the test above covers the honest case.
    await expectApiError(
      service.refresh(mintRefreshToken(user.id, { iat: Math.floor(Date.now() / 1000) - 3600 })),
      401,
      ErrorCode.UNAUTHORIZED,
    );
    expect(refreshToken).toBeTruthy();
  });

  it('refuses to reuse the current password, and has nothing to change on a social-only account', async () => {
    const { user } = await register();
    await expectApiError(
      service.changePassword(user.id, { currentPassword: ALICE.password, newPassword: ALICE.password }),
      400,
      ErrorCode.PASSWORD_MISMATCH,
    );

    const social = await service.findOrCreateOAuthUser(PROFILE);
    await expectApiError(
      service.changePassword(userIdOf(social.accessToken), { currentPassword: 'whatever', newPassword: 'a brand new secret' }),
      400,
      ErrorCode.SOCIAL_ONLY_ACCOUNT,
    );
  });

  // ─── Reset flow ──────────────────────────────────────────────────────────────

  it('answers the same whether or not the address exists, and stores a token only when it does', async () => {
    const { user } = await register();

    const known = await service.forgotPassword({ email: ALICE.email });
    const unknown = await service.forgotPassword({ email: 'nobody@example.com' });

    expect(known).toEqual(unknown);
    expect(known.message).toMatch(/if that email exists/i);
    expect(prisma.passwordReset.rows).toHaveLength(1);
    expect(prisma.passwordReset.rows[0].userId).toBe(user.id);
    expect(mailer.sendPasswordReset).toHaveBeenCalledTimes(1);
  });

  it('survives a mail provider outage and still stores a usable token', async () => {
    await register();
    mailer.sendPasswordReset.mockRejectedValue(new Error('SendGrid is unreachable'));

    await expect(service.forgotPassword({ email: ALICE.email })).resolves.toMatchObject({
      message: 'If that email exists, a reset link is on its way.',
    });
    expect(prisma.passwordReset.rows).toHaveLength(1);
  });

  it('burns an earlier link as soon as a new one is requested', async () => {
    await register();
    await service.forgotPassword({ email: ALICE.email });
    const first = prisma.passwordReset.rows[0].token;
    await service.forgotPassword({ email: ALICE.email });

    expect(prisma.passwordReset.rows).toHaveLength(2);
    await expectApiError(service.resetPassword({ token: first, newPassword: 'brand new secret' }), 400, ErrorCode.RESET_TOKEN_USED);
  });

  it('resets the password once, then refuses the same token', async () => {
    await register();
    await service.forgotPassword({ email: ALICE.email });
    const token = prisma.passwordReset.rows[0].token;

    await service.resetPassword({ token, newPassword: 'brand new secret' });

    expect(await service.login({ email: ALICE.email, password: 'brand new secret' })).toHaveProperty('accessToken');
    await expectApiError(service.resetPassword({ token, newPassword: 'another secret' }), 400, ErrorCode.RESET_TOKEN_USED);
  });

  it('rejects an unknown reset token', async () => {
    await expectApiError(
      service.resetPassword({ token: 'a'.repeat(64), newPassword: 'brand new secret' }),
      400,
      ErrorCode.INVALID_RESET_TOKEN,
    );
  });

  it('rejects an expired reset token', async () => {
    await register();
    await service.forgotPassword({ email: ALICE.email });
    prisma.passwordReset.rows[0].expiresAt = new Date(Date.now() - 1000);

    const token = prisma.passwordReset.rows[0].token;
    await expectApiError(service.resetPassword({ token, newPassword: 'brand new secret' }), 400, ErrorCode.RESET_TOKEN_EXPIRED);
  });

  // ─── OAuth sign-in, linking and stored tokens ────────────────────────────────

  it('creates an account for a new provider profile and stores its tokens encrypted', async () => {
    await service.findOrCreateOAuthUser(PROFILE);

    const account = prisma.oAuthAccount.rows[0];
    expect(account).toMatchObject({ provider: 'github', providerUid: '12345' });
    expect(account.accessToken).toMatch(/^v1:/);
    expect(account.accessToken).not.toContain(PROFILE.accessToken);
    expect(tokenCrypto.decrypt(account.accessToken)).toBe(PROFILE.accessToken);
    expect(prisma.user.rows[0]).toMatchObject({ email: PROFILE.email, username: 'adalovelace' });
  });

  it('reuses the same account for a returning provider login', async () => {
    const first = await service.findOrCreateOAuthUser(PROFILE);
    const again = await service.findOrCreateOAuthUser({ ...PROFILE, accessToken: 'ghp_rotated' });

    expect(prisma.user.rows).toHaveLength(1);
    expect(prisma.oAuthAccount.rows).toHaveLength(1);
    expect(tokenCrypto.decrypt(prisma.oAuthAccount.rows[0].accessToken)).toBe('ghp_rotated');
    expect(userIdOf(first.accessToken)).toBe(userIdOf(again.accessToken));
  });

  it('links a provider to the password account that already owns the address', async () => {
    const { user } = await register();

    await service.findOrCreateOAuthUser({ ...PROFILE, email: ALICE.email });

    expect(prisma.user.rows).toHaveLength(1);
    expect(prisma.oAuthAccount.rows[0].userId).toBe(user.id);
  });

  it('derives a unique username when two provider profiles share a display name', async () => {
    await service.findOrCreateOAuthUser(PROFILE);
    await service.findOrCreateOAuthUser({ ...PROFILE, providerUid: '99999', email: 'ada2@example.com' });

    expect(prisma.user.rows.map((u) => u.username)).toEqual(['adalovelace', 'adalovelace1']);
  });

  it('reads a stored provider token back for server-side use only', async () => {
    const created = await service.findOrCreateOAuthUser(PROFILE);

    expect(await service.getProviderAccessToken(userIdOf(created.accessToken), 'github')).toBe(PROFILE.accessToken);
    expect(await service.getProviderAccessToken(userIdOf(created.accessToken), 'google')).toBeNull();
  });

  it('attaches a provider to the logged-in account by id, not by email', async () => {
    const { user } = await register();

    await service.linkOAuthAccount(user.id, { ...PROFILE, email: 'a-different-address@example.com' });

    expect(prisma.user.rows).toHaveLength(1);
    expect(prisma.oAuthAccount.rows[0]).toMatchObject({ userId: user.id, provider: 'github' });
  });

  it('refuses to link a provider account that already belongs to somebody else', async () => {
    const { user } = await register();
    const other = await service.findOrCreateOAuthUser({ ...PROFILE, email: 'other@example.com' });

    await expectApiError(service.linkOAuthAccount(user.id, PROFILE), 409, ErrorCode.OAUTH_ACCOUNT_LINKED_ELSEWHERE);
    expect(prisma.oAuthAccount.rows).toHaveLength(1);
    expect(prisma.oAuthAccount.rows[0].userId).toBe(userIdOf(other.accessToken));
  });

  it('accepts a link state for its own purpose only', () => {
    const state = service.createLinkState('calice0000000000000000001');

    expect(service.verifyLinkState(state)).toBe('calice0000000000000000001');
    expect(service.verifyLinkState(undefined)).toBeNull();
    expect(service.verifyLinkState('junk')).toBeNull();
    // A validly signed access token is not a statement of link intent.
    expect(
      service.verifyLinkState(jwt.sign({ sub: 'calice0000000000000000001' }, { secret: 'test-access-secret', expiresIn: '5m' })),
    ).toBeNull();
  });
});
