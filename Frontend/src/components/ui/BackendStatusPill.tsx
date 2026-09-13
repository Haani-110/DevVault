import { useBackendStatus, type BackendStatus } from '@/hooks/useBackendStatus';

const COPY: Record<BackendStatus, { label: string; tone: string; dot: string }> = {
  checking: {
    label: 'Checking server…',
    tone: 'bg-surface text-text-muted',
    dot: 'bg-text-muted animate-pulse',
  },
  online: {
    label: 'Server reachable',
    tone: 'bg-green-500/10 text-green-400 border border-green-500/20',
    dot: 'bg-green-400',
  },
  degraded: {
    label:
      'Server is up but cannot reach its database — sign-in will not work until that is fixed.',
    tone: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    dot: 'bg-amber-400',
  },
  offline: {
    label: 'Cannot reach server. Backend may be down — try reloading.',
    tone: 'bg-red-500/10 text-red-400 border border-red-500/20',
    dot: 'bg-red-400',
  },
};

/**
 * The banner above the sign-in forms. Extracted because Login and Register each
 * carried their own copy of it — including their own `fetch` that POSTed bad
 * credentials to `/auth/login` on mount — and only one of them would ever get
 * fixed.
 *
 * Renders nothing unless the caller asks for a specific status, so a page can
 * also drive it from `useBackendStatus()` itself.
 */
export default function BackendStatusPill({
  status,
  okLabel,
}: {
  /** Pass a status to drive it from elsewhere; omit to check on mount. */
  status?: BackendStatus;
  /** Page-specific copy for the reachable case. */
  okLabel?: string;
}) {
  const own = useBackendStatus();
  const current = status ?? own.status;
  const copy = okLabel && current === 'online' ? { ...COPY.online, label: okLabel } : COPY[current];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`text-xs px-3 py-2 rounded-lg mb-5 flex items-center gap-2 ${copy.tone}`}
    >
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${copy.dot}`} aria-hidden="true" />
      {copy.label}
    </div>
  );
}
