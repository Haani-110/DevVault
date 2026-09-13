import { useEffect, useRef } from 'react';

/**
 * Escape-to-dismiss for the modals that render their own backdrop instead of
 * going through `ModalShell`. `enabled` lets a caller keep Escape dead while a
 * request is in flight, so a save cannot be cancelled out from under the user.
 *
 * The callback is kept in a ref on purpose: callers pass inline arrow functions,
 * and depending on it directly would tear down and re-add the listener on every
 * render.
 */
export function useEscapeKey(onEscape: (() => void) | undefined, enabled = true) {
  const latest = useRef(onEscape);
  latest.current = onEscape;

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        latest.current?.();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);
}
