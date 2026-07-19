import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBell, FiSearch, FiLogOut, FiSettings, FiCheck } from 'react-icons/fi';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '@/hooks/useAuth';

interface Notification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  time: string;
}

const SAMPLE_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    title: 'Welcome to DevVault 👋',
    body: 'Your workspace is ready. Start by creating a note or a snippet.',
    read: false,
    time: 'Just now',
  },
  {
    id: '2',
    title: 'OAuth is configured',
    body: 'Google and GitHub sign-in are ready. Add your credentials to activate them.',
    read: false,
    time: '2 min ago',
  },
];

export default function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(SAMPLE_NOTIFICATIONS);
  const [search, setSearch] = useState('');

  const unreadCount = notifications.filter((n) => !n.read).length;

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function markRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  }

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
        <div className="relative">
          <button
            aria-label="Notifications"
            onClick={() => { setNotifOpen((o) => !o); setMenuOpen(false); }}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors relative"
          >
            <FiBell size={15} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-brass-400" />
            )}
          </button>

          {notifOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-80 card shadow-xl z-30 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="text-[11px] font-bold bg-brass-400/15 text-brass-400 rounded-full px-1.5 py-0.5">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="flex items-center gap-1 text-xs text-text-muted hover:text-brass-400 transition-colors"
                    >
                      <FiCheck size={12} /> Mark all read
                    </button>
                  )}
                </div>

                {/* List */}
                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2 text-text-faint">
                      <FiBell size={22} />
                      <p className="text-xs">No notifications yet</p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => markRead(n.id)}
                        className={`w-full text-left px-4 py-3 border-b border-border/50 last:border-0 hover:bg-surface-hover transition-colors flex gap-3 ${
                          n.read ? 'opacity-60' : ''
                        }`}
                      >
                        <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${n.read ? 'bg-transparent' : 'bg-brass-400'}`} />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">{n.title}</p>
                          <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{n.body}</p>
                          <p className="text-[11px] text-text-faint mt-1">{n.time}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                {/* Footer */}
                <div className="px-4 py-2.5 border-t border-border bg-surface-raised/40">
                  <p className="text-[11px] text-text-faint text-center">
                    Real-time notifications coming in v2.0
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        <ThemeToggle />

        <div className="w-px h-5 bg-border mx-1" />

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-surface-hover transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-brass-400/15 border border-brass-400/40 flex items-center justify-center text-brass-400 text-xs font-bold font-mono overflow-hidden">
              {user?.avatarUrl
                ? <img src={user.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                : initials}
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
