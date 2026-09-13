import axios from 'axios';
import { useAuthStore } from '@/store/authStore';

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Set by the response interceptor on the request it already replayed once. */
    _retry?: boolean;
    /** Set on the refresh request itself, which must not trigger another refresh. */
    _skipAuthRetry?: boolean;
  }
}

// In dev, Vite proxies /api → localhost:4000, so a relative URL works.
// In production (Vercel), there is no proxy — VITE_API_BASE_URL must point to the deployed backend.
const baseURL = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/api/v1`
  : '/api/v1';

export const api = axios.create({
  baseURL,
  timeout: 15_000,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let queue: Array<{ succeed: () => void; fail: (reason: unknown) => void }> = [];

/**
 * One refresh, then one replay of each request that was waiting on it.
 *
 * Two guards keep this from deadlocking itself. `_skipAuthRetry` marks the
 * refresh call itself: without it, a refresh that comes back 401 enters this
 * handler again, sees `isRefreshing`, and queues a callback that only the
 * original refresh would ever have run — so nothing settles and the caller
 * hangs forever. And only requests that actually carried a token are retried,
 * which keeps a wrong password from triggering a refresh of its own.
 */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status !== 401 || !original || original._retry || original._skipAuthRetry) {
      return Promise.reject(error);
    }
    if (!original.headers?.Authorization) {
      return Promise.reject(error);
    }

    original._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        queue.push({ succeed: () => resolve(api(original)), fail: reject });
      });
    }

    isRefreshing = true;
    try {
      const refreshToken = useAuthStore.getState().refreshToken;
      const { data } = await api.post('/auth/refresh', { refreshToken }, { _skipAuthRetry: true });
      useAuthStore.getState().setTokens(data.accessToken, data.refreshToken);
      queue.forEach((waiting) => waiting.succeed());
      queue = [];
      return api(original);
    } catch (refreshError) {
      // Fail everyone this refresh was holding up. Leaving their promises
      // pending is how a stale session ends up as a permanent spinner instead
      // of a sign-out.
      queue.forEach((waiting) => waiting.fail(refreshError));
      queue = [];
      useAuthStore.getState().logout();
      window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);
