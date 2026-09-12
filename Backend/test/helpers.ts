import { ApiException } from '../src/common/errors/api-exception';
import type { ErrorCode } from '../src/common/errors/error-codes';

/**
 * Asserts that a promise failed with a specific `ApiException`.
 *
 * Written as a helper rather than `expect(...).rejects.toThrow(/…/)` because a
 * message is copy that is allowed to change, while the status and the stable
 * `code` are the contract — the same reason clients are told to branch on
 * `code`.
 */
export async function expectApiError(
  promise: Promise<unknown>,
  status: number,
  code: ErrorCode,
): Promise<ApiException> {
  const error = await promise.then(
    () => null,
    (err: unknown) => err,
  );

  if (!error) throw new Error(`Expected the call to fail with ${code}, but it resolved`);
  if (!(error instanceof ApiException)) throw new Error(`Expected an ApiException, got ${String(error)}`);
  expect(error.getStatus()).toBe(status);
  expect(error.code).toBe(code);

  return error;
}

/** A GitHub-ish user record, for the specs that only need "a logged-in user". */
export function userRow(overrides: Record<string, unknown> = {}) {
  return {
    email: 'dev@example.com',
    username: 'dev',
    passwordHash: null,
    ...overrides,
  };
}

/**
 * Everything a caller can distinguish about a failed request, as plain data.
 * Used where the *point* of the test is that two failures are indistinguishable
 * (login, "not found" vs "not yours") — comparing this object says that exactly,
 * while `toThrow(/…/)` would only compare one string.
 */
export function observableFailure(error: unknown): { statusCode: number; code: string; message: string } {
  const e = error as { getStatus?: () => number; code?: string; message?: string };

  return {
    statusCode: e?.getStatus?.() ?? 0,
    code: e?.code ?? '',
    message: e?.message ?? '',
  };
}
