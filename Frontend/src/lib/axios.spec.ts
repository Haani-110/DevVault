import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';


/**
 * Imports a fresh copy of the axios instance with an adapter that answers from
 * `handler`. A fresh copy matters because the refresh interceptor keeps
 * module-level state (`isRefreshing`, the waiter queue) between tests.
 */
type Handler = { status: number; data?: unknown };

async function loadApi(handler: (config: InternalAxiosRequestConfig) => Handler) {
  vi.resetModules();
  const [{ api }, { useAuthStore }] = await Promise.all([import('@/lib/axios'), import('@/store/authStore')]);

  const calls: string[] = [];
  api.defaults.adapter = async (config) => {
    calls.push(String(config.url));
    const { status, data } = handler(config);
    const response = { data: data ?? {}, status, statusText: '', headers: {}, config } as AxiosResponse;
    if (status >= 400) {
      throw new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_REQUEST', config, {}, response);
    }
    return response;
  };

  return { api, useAuthStore, calls };
}

const pathOf = (url: string) => url.replace(/^.*\/api\/v1/, '');

describe('auth refresh interceptor', () => {
  let redirectedTo: string | undefined;

  beforeEach(() => {
    // The interceptor sends a hard redirect when a session cannot be revived.
    redirectedTo = undefined;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: '', get pathname() { return '/notes'; }, assign: () => {} },
    });
    Object.defineProperty(window.location, 'href', {
      configurable: true,
      get: () => redirectedTo,
      set: (value: string) => {
        redirectedTo = value;
      },
    });
  });

  it('replays the original request once the token is refreshed', async () => {
    const seen = { notes: 0 };
    const { api, useAuthStore, calls } = await loadApi((config) => {
      const path = pathOf(String(config.url));
      if (path === '/auth/refresh') return { status: 200, data: { accessToken: 'fresh', refreshToken: 'fresh-r' } };
      seen.notes += 1;
      // The first attempt carries the expired token; the replay carries the new one.
      return config.headers?.Authorization === 'Bearer fresh'
        ? { status: 200, data: [{ id: 'n1' }] }
        : { status: 401, data: { statusCode: 401, code: 'UNAUTHORIZED', message: 'jwt expired' } };
    });
    useAuthStore.getState().setTokens('expired', 'valid-refresh');

    const { data } = await api.get('/notes');

    expect(data).toEqual([{ id: 'n1' }]);
    expect(seen.notes).toBe(2);
    expect(calls.filter((c) => c.includes('/auth/refresh'))).toHaveLength(1);
    expect(useAuthStore.getState().accessToken).toBe('fresh');
  });

  it('signs the user out instead of never settling when the refresh is rejected too', async () => {
    // This is the regression test for a deadlock: the refresh request itself hit
    // the 401 handler, saw `isRefreshing`, and queued a promise that only the
    // refresh it was waiting on could resolve. Nothing settled, so a 7-day-old
    // session meant an eternal spinner rather than a login screen.
    const { api, useAuthStore } = await loadApi((config) => {
      const path = pathOf(String(config.url));
      if (path === '/auth/refresh') {
        return { status: 401, data: { statusCode: 401, code: 'UNAUTHORIZED', message: 'invalid token' } };
      }
      return { status: 401, data: { statusCode: 401, code: 'UNAUTHORIZED', message: 'jwt expired' } };
    });
    useAuthStore.getState().setTokens('expired', 'expired-too');

    await expect(api.get('/notes')).rejects.toBeInstanceOf(AxiosError);

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(redirectedTo).toBe('/login');
  }, 3000);

  it('does not try to refresh for a route that never carried a token', async () => {
    // A wrong password is a 401 from /auth/login. Refreshing there would sign the
    // user out of a session they were not using and hide the real message.
    const { api, calls } = await loadApi(() => ({
      status: 401,
      data: { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
    }));

    await expect(api.post('/auth/login', { email: 'a@b.c', password: 'nope' })).rejects.toBeInstanceOf(AxiosError);

    expect(calls).toEqual(['/auth/login']);
  });
});
