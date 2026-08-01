import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { FiGrid, FiFileText, FiFolder, FiCode, FiSend, FiSettings, FiX } from 'react-icons/fi';
import VaultDial from '@/components/ui/VaultDial';
import Badge from '@/components/ui/Badge';

interface NavItem {
  to: string;
  label: string;
  icon: any;
  soon?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// Grouped into sections (rather than one flat list) — reads more like an
// organized ledger/directory than a generic sidebar menu.
const navGroups: NavGroup[] = [
  {
    label: 'Workspace',
    items: [{ to: '/dashboard', label: 'Dashboard', icon: FiGrid }],
  },
  {
    label: 'Library',
    items: [
      { to: '/notes', label: 'Notes', icon: FiFileText },
      { to: '/snippets', label: 'Snippets', icon: FiCode },
    ],
  },
  {
    label: 'Projects',
    items: [
      { to: '/projects', label: 'Projects', icon: FiFolder },
      { to: '/collections', label: 'API Collections', icon: FiSend, soon: true },
    ],
  },
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

        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {navGroups.map((group, i) => (
            <div key={group.label} className={i > 0 ? 'mt-5' : ''}>
              <p className="px-3 mb-1.5 text-[10px] font-semibold tracking-[0.12em] uppercase text-text-faint">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(({ to, label, icon: Icon, soon }) => (
                  <NavLink
                    key={to}
                    to={soon ? '#' : to}
                    onClick={(e) => {
                      if (soon) e.preventDefault();
                      else onClose?.();
                    }}
                    className={({ isActive }) =>
                      clsx(
                        'relative flex items-center justify-between gap-2.5 pl-3.5 pr-3 py-2 rounded text-sm font-medium transition-colors',
                        soon
                          ? 'text-text-faint cursor-not-allowed'
                          : isActive
                            ? 'bg-brass-400/10 text-brass-400'
                            : 'text-text-muted hover:text-text hover:bg-surface-hover'
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {/* Ledger-tab style active indicator, instead of just a background tint */}
                        {isActive && !soon && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-brass-400" />
                        )}
                        <span className="flex items-center gap-2.5">
                          <Icon size={16} />
                          {label}
                        </span>
                        {soon && <Badge tone="muted">Soon</Badge>}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-border">
          <NavLink
            to="/settings"
            onClick={() => onClose?.()}
            className={({ isActive }) =>
              clsx(
                'relative flex items-center gap-2.5 pl-3.5 pr-3 py-2 rounded text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brass-400/10 text-brass-400'
                  : 'text-text-muted hover:text-text hover:bg-surface-hover'
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-brass-400" />}
                <FiSettings size={16} />
                Settings
              </>
            )}
          </NavLink>
        </div>
      </aside>
    </>
  );
}
