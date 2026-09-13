import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/axios';

export type BackendStatus = 'checking' | 'online' | 'degraded' | 'offline';

interface HealthReport {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
  uptimeSeconds: number;
  timestamp: string;
}

/**
 * "Is the API there, and is it healthy?" — for the sign-in screens and anywhere
 * else a failure is more likely to be a stopped backend than a bad form.
 *
 * It asks `GET /health`, which is unauthenticated, never rate limited and says
 * something no other endpoint can: the API answering `503 database: down` is a
 * different problem from nothing answering at all, and telling a user "the
 * server is up but cannot reach its database" saves them from restarting
 * something that was never the cause. (The version this replaces POSTed
 * deliberately wrong credentials to `/auth/login` and read the 401 as success —
 * which wrote a failed-login entry every time a page mounted.)
 */
export function useBackendStatus({ pollMs = 0 }: { pollMs?: number } = {}) {
  const [status, setStatus] = useState<BackendStatus>('checking');
  const [checkedAt, setCheckedAt] = useState<number | null>(null);

  const check = useCallback(async () => {
    try {
      const { data } = await api.get<HealthReport>('/health', { timeout: 4_000 });
      setStatus(data?.database === 'down' ? 'degraded' : 'online');
    } catch (error) {
      // Any HTTP answer means the API process is alive, whatever it thinks of
      // the request — only a rejection without a response means nothing is there.
      const httpStatus = (error as { response?: { status?: number } })?.response?.status;

      if (httpStatus === 503) setStatus('degraded');
      else if (typeof httpStatus === 'number') setStatus('online');
      else setStatus('offline');
    } finally {
      setCheckedAt(Date.now());
    }
  }, []);

  useEffect(() => {
    void check();
    if (!pollMs) return;

    const id = setInterval(() => void check(), pollMs);
    return () => clearInterval(id);
  }, [check, pollMs]);

  return { status, check, checkedAt };
}
