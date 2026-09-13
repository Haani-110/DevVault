import { useEffect } from 'react';

/**
 * Escape-to-dismiss for the modals that render their own backdrop instead of
 * going through `ModalShell`. `enabled` lets a caller keep Escape dead while a
 * request is in flight, so a save cannot be cancelled out from under the user.
 */
export function useEscapeKey(onEscape: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onEscape();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onEscape, enabled]);
}
