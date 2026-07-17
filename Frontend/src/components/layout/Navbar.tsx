import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBell, FiSearch, FiLogOut, FiSettings } from 'react-icons/fi';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '@/hooks/useAuth';

export default function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');

  function handleSearch(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && search.trim()) {
      // Future: navigate to search results
      setSearch('');
    }
  }

  const initials = user?.username?.slice(0, 2).toUpperCase() ?? 'DV';

  return (
    <header className="h-14 border-b border-border bg-ink/90 backdrop-blur-sm sticky top-0 z-10 flex items-center justify-between px-5 gap-4">
      {/* Search */}
      <div className="relative flex-1 max-w-xs">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" size={14} />
        <input
          className="input pl-8 py-1.5 text-sm bg-surface-raised/60 border-border/60 focus:bg-surface-raised"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleSearch}
          aria-label="Global search"
        />
      </div>

      <div className="flex items-center gap-2">
        {/* Notifications */}
        <button
          aria-label="Notifications"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors relative"
        >
          <FiBell size={15} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-brass-400" />
        </button>

        <ThemeToggle />

        <div className="w-px h-5 bg-border mx-1" />

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-surface-hover transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-brass-400/15 border border-brass-400/40 flex items-center justify-center text-brass-400 text-xs font-bold font-mono">
              {initials}
            </div>
            <span className="text-sm text-text-muted hidden sm:block max-w-[120px] truncate">
              {user?.username ?? 'Developer'}
            </span>
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-52 card shadow-xl z-30 py-1 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border">
                  <p className="text-xs font-semibold text-text truncate">{user?.username}</p>
                  <p className="text-[11px] text-text-faint truncate">{user?.email}</p>
                </div>
                <button
                  onClick={() => { navigate('/settings'); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
                >
                  <FiSettings size={14} /> Settings
                </button>
                <button
                  onClick={() => { setMenuOpen(false); signOut(); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-400 hover:bg-red-400/5 transition-colors"
                >
                  <FiLogOut size={14} /> Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
