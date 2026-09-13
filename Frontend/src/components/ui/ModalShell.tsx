import { useEffect, useId, useRef } from 'react';
import { FiX } from 'react-icons/fi';
import { useEscapeKey } from '@/hooks/useEscapeKey';

interface Props {
  title: string;
  onClose: () => void;
  /**
   * Blocks Escape and backdrop clicks while true — used for anything with
   * in-flight work, where closing the dialog would leave the user looking at
   * nothing while the job continues.
   */
  dismissable?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  /** Optional element rendered after the title, before the close button. */
  headerAside?: React.ReactNode;
  className?: string;
}

/**
 * Backdrop + panel + header, with the three things a hand-rolled modal in this
 * app kept missing: Escape closes it, focus starts inside it, and assistive
 * technology is told it is a dialog (`role`, `aria-modal`, a labelled title).
 *
 * `dismissable` exists because "close" is not always safe — an import in
 * progress should not be closable by accident, and neither modal used to have a
 * way to say that.
 */
export default function ModalShell({
  title,
  onClose,
  dismissable = true,
  icon,
  children,
  headerAside,
  className = 'max-w-lg',
}: Props) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEscapeKey(onClose, dismissable);

  // Focus the panel once, so keyboard users land inside the dialog instead of
  // behind it. `preventScroll` keeps a long page from jumping.
  useEffect(() => {
    panel.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (dismissable && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`card w-full ${className} flex flex-col max-h-[85vh] outline-none`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 id={titleId} className="font-display font-semibold text-lg flex items-center gap-2">
            {icon}
            {title}
          </h2>
          <div className="flex items-center gap-2">
            {headerAside}
            {dismissable && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="w-7 h-7 flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
              >
                <FiX size={16} />
              </button>
            )}
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
