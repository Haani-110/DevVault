import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { FiGrid, FiFileText, FiFolder, FiCode, FiSend, FiLock, FiSettings } from 'react-icons/fi';
import VaultDial from '@/components/ui/VaultDial';
import Badge from '@/components/ui/Badge';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: FiGrid },
  { to: '/notes', label: 'Notes', icon: FiFileText },
  { to: '/snippets', label: 'Snippets', icon: FiCode },
  { to: '/projects', label: 'Projects', icon: FiFolder },
  { to: '/collections', label: 'API Collections', icon: FiSend },
  { to: '/vault', label: 'Password Vault', icon: FiLock },
];

export default function Sidebar() {
  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 border-r border-border bg-ink-soft flex flex-col">
      <div className="h-16 flex items-center gap-2.5 px-5 border-b border-border">
        <VaultDial size={26} />
        <span className="font-display font-semibold text-[15px] tracking-tight">
          Dev<span className="text-brass-400">Vault</span>
        </span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon, soon }) => (
          <NavLink
            key={to}
            to={soon ? '#' : to}
            onClick={(e) => soon && e.preventDefault()}
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
  );
}
