import { useCallback, useEffect, useRef, useState } from 'react';
import { toApiError, type ApiError } from '@/lib/api-error';
import { importService, isTerminal, type ImportJob } from '@/services/importService';

/** Slightly slower than the backend's progress-write coalescing, so no tick is wasted. */
const POLL_MS = 1_800;

export interface GithubImportController {
  /** The job being watched, or null when there is nothing to show yet. */
  job: ImportJob | null;
  starting: boolean;
  error: ApiError | null;
  /** False until the "is a job already running?" check has answered. */
  resumeChecked: boolean;
  start: (owner: string, repo: string, branch?: string) => Promise<void>;
  reset: () => void;
}

/**
 * Watches a GitHub import job: starts one, polls it to a terminal state, and
 * picks one back up after a reload.
 *
 * The polling loop reschedules itself instead of using an interval, so a slow
 * response can never produce two requests in flight; every reply is checked
 * against the id it belongs to, so an answer for a job the user has since
 * abandoned cannot overwrite the current one; and the timer is cleared on
 * unmount, which is what stops a dialog closed mid-import from polling forever
 * in the background.
 */
export function useGithubImport({
  resumeOnMount = true,
}: { resumeOnMount?: boolean } = {}): GithubImportController {
  const [job, setJob] = useState<ImportJob | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [resumeChecked, setResumeChecked] = useState(!resumeOnMount);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watching = useRef<string | null>(null);
  const alive = useRef(true);

  useEffect(
    () => () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const stop = useCallback(() => {
    watching.current = null;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const watch = useCallback(
    async (jobId: string) => {
      watching.current = jobId;

      const tick = async () => {
        if (watching.current !== jobId) return;

        let fresh: ImportJob;
        try {
          fresh = await importService.getJob(jobId);
        } catch (err) {
          if (watching.current !== jobId || !alive.current) return;
          stop();
          setError(toApiError(err, 'Lost track of this import — it may still be finishing.'));
          return;
        }

        if (watching.current !== jobId || !alive.current) return;
        setJob(fresh);
        setError(null);

        if (isTerminal(fresh)) {
          stop();
          return;
        }

        timer.current = setTimeout(tick, POLL_MS);
      };

      await tick();
    },
    [stop]
  );

  const start = useCallback(
    async (owner: string, repo: string, branch?: string) => {
      setStarting(true);
      setError(null);

      try {
        const { jobId } = await importService.startImport(owner, repo, branch);
        await watch(jobId);
      } catch (err) {
        const apiError = toApiError(err);

        // A job is already running for this account. Showing it is more useful
        // than showing a refusal — and it is the same work the user asked for.
        if (apiError.code === 'IMPORT_ALREADY_RUNNING') {
          const running = await importService.getLatestJob().catch(() => null);
          if (running && !isTerminal(running)) {
            setJob(running);
            setError({
              ...apiError,
              message: `An import is already running: ${running.repoFullName}.`,
            });
            await watch(running.jobId);
          } else {
            setError(apiError);
          }
        } else {
          setError(apiError);
        }
      } finally {
        if (alive.current) setStarting(false);
      }
    },
    [watch]
  );

  const reset = useCallback(() => {
    stop();
    setJob(null);
    setError(null);
  }, [stop]);

  useEffect(() => {
    if (!resumeOnMount) return;

    let cancelled = false;
    importService
      .getLatestJob()
      .then((latest) => {
        if (cancelled || !latest) return;
        setJob(latest);
        // A job that is still moving is worth following; one that finished is
        // only interesting the moment it finishes, so it is not re-shown here.
        if (!isTerminal(latest)) void watch(latest.jobId);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setResumeChecked(true);
      });

    return () => {
      cancelled = true;
    };
  }, [resumeOnMount, watch]);

  return { job, starting, error, resumeChecked, start, reset };
}
