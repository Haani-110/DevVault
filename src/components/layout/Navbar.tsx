import { FiSearch, FiBell } from 'react-icons/fi';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '@/hooks/useAuth';

export default function Navbar() {
  const { user, signOut } = useAuth();

  return (
    <header className="h-16 border-b border-border bg-ink/80 backdrop-blur sticky top-0 z-10 flex items-center justify-between px-6 gap-4">
      <div className="relative w-full max-w-sm">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" size={15} />
        <input
          className="input pl-9"
          placeholder="Search notes, projects, snippets…"
          aria-label="Global search"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          aria-label="Notifications"
          className="w-9 h-9 flex items-center justify-center rounded border border-border text-text-muted hover:text-text hover:bg-surface-hover transition-colors relative"
        >
          <FiBell size={16} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-brass-400" />
        </button>
        <ThemeToggle />
        <div className="w-px h-6 bg-border" />
        <button onClick={signOut} className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-full bg-brass-400/15 border border-brass-400/30 flex items-center justify-center text-brass-400 text-xs font-semibold font-mono">
            {user?.username?.slice(0, 2).toUpperCase() ?? 'DV'}
          </div>
          <span className="text-sm text-text-muted group-hover:text-text transition-colors hidden sm:inline">
            {user?.username ?? 'Guest'}
          </span>
        </button>
      </div>
    </header>
  );
}
