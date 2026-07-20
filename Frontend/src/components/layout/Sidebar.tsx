import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { FiGrid, FiFileText, FiFolder, FiCode, FiSend, FiLock, FiSettings, FiX } from 'react-icons/fi';
import VaultDial from '@/components/ui/VaultDial';
import Badge from '@/components/ui/Badge';

const navItems: {
  to: string;
  label: string;
  icon: any;
  soon?: boolean;
}[] = [
  { to: '/dashboard', label: 'Dashboard', icon: FiGrid },
  { to: '/notes', label: 'Notes', icon: FiFileText },
  { to: '/snippets', label: 'Snippets', icon: FiCode },
  { to: '/projects', label: 'Projects', icon: FiFolder },
  { to: '/collections', label: 'API Collections', icon: FiSend },
  { to: '/vault', label: 'Password Vault', icon: FiLock },
];

interface Props {
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ open = false, onClose }: Props) {
  return (
    <>
      {/* Mobile backdrop — tapping it closes the drawer. Hidden entirely on desktop. */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={clsx(
          'w-64 shrink-0 h-screen bg-ink-soft flex flex-col border-r border-border',
          // Mobile: fixed off-canvas drawer that slides in/out.
          'fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out',
          open ? 'translate-x-0' : '-translate-x-full',
          // Desktop: back to a normal sticky in-flow sidebar, always visible.
          'lg:translate-x-0 lg:static lg:z-auto lg:sticky lg:top-0',
        )}
      >
        <div className="h-16 flex items-center justify-between gap-2.5 px-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <VaultDial size={26} />
            <span className="font-display font-semibold text-[15px] tracking-tight">
              Dev<span className="text-brass-400">Vault</span>
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
          >
            <FiX size={18} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon, soon }) => (
            <NavLink
              key={to}
              to={soon ? '#' : to}
              onClick={(e) => {
                if (soon) e.preventDefault();
                else onClose?.();
              }}
              className={({ isActive }) =>
                clsx(
                  'flex items-center justify-between gap-2.5 px-3 py-2 rounded text-sm font-medium transition-colors',
                  soon
                    ? 'text-text-faint cursor-not-allowed'
                    : isActive
                      ? 'bg-brass-400/10 text-brass-400'
                      : 'text-text-muted hover:text-text hover:bg-surface-hover'
                )
              }
            >
              <span className="flex items-center gap-2.5">
                <Icon size={16} />
                {label}
              </span>
              {soon && <Badge tone="muted">Soon</Badge>}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-border">
          <NavLink
            to="/settings"
            onClick={() => onClose?.()}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brass-400/10 text-brass-400'
                  : 'text-text-muted hover:text-text hover:bg-surface-hover'
              )
            }
          >
            <FiSettings size={16} />
            Settings
          </NavLink>
        </div>
      </aside>
    </>
  );
}
