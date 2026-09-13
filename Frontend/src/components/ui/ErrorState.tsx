import { FiAlertTriangle, FiRefreshCw } from 'react-icons/fi';
import type { ApiError } from '@/lib/api-error';

interface Props {
  /** What went wrong. A plain string is shown as-is; an ApiError adds its code. */
  error: ApiError | string | null | undefined;
  /** What this operation was, so the message is a sentence and not "Error". */
  action?: string;
  onRetry?: () => void;
  retryLabel?: string;
  /** Extra content under the message — a "Connect GitHub" button, for example. */
  children?: React.ReactNode;
}

/**
 * A failure that says what failed and what to do next.
 *
 * The `code` is shown on purpose (in small type, not in the sentence): when a
 * user reports "it said cannot reach the server", the code is what makes the
 * report answerable without asking them to open dev tools.
 */
export default function ErrorState({
  error,
  action,
  onRetry,
  retryLabel = 'Try again',
  children,
}: Props) {
  if (!error) return null;

  const message = typeof error === 'string' ? error : error.message;
  const code = typeof error === 'string' ? null : error.code;

  return (
    <div
      role="alert"
      className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3.5 text-left"
    >
      <div className="flex items-start gap-2.5">
        <FiAlertTriangle size={15} className="text-danger mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-text font-medium leading-snug">
            {action ? `${action}: ` : ''}
            {message}
          </p>
          {code && <p className="text-[11px] font-mono text-text-faint mt-1">{code}</p>}
        </div>
      </div>

      {(onRetry || children) && (
        <div className="mt-3 flex items-center gap-2 pl-6">
          {onRetry && (
            <button type="button" onClick={onRetry} className="btn-ghost !py-1.5 !px-3 text-xs">
              <FiRefreshCw size={12} /> {retryLabel}
            </button>
          )}
          {children}
        </div>
      )}
    </div>
  );
}
