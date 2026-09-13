import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/axios';
import VaultDial from '@/components/ui/VaultDial';

/**
 * Landing page for a Google/GitHub sign-in: the backend redirects here with the
 * finished session in the URL *fragment*, this reads it, stores it, and wipes it
 * out of the address bar and the history entry.
 *
 * The fragment (not the query string) is the point — it is never sent to a
 * server, never lands in an access log and never leaks through a `Referer`
 * header, so a bearer token does not sit in places nobody intended. Reading the
 * query string as a fallback only keeps an in-flight old tab working.
 */
export default function OAuthCallback() {
  const navigate = useNavigate();
  const { setUser, setTokens } = useAuthStore();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    // `URLSearchParams` accepts a leading `#`-less string; hash is "#accessToken=…"
    const params = new URLSearchParams(window.location.hash.replace(/^#/, '') || window.location.search);
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');
    const error = params.get('error') ?? params.get('oauthError');

    // Whatever happens next, the tokens should not stay in the URL.
    window.history.replaceState(null, '', window.location.pathname);

    if (error || !accessToken || !refreshToken) {
      navigate(`/login?oauthError=${encodeURIComponent(error ?? 'Authentication failed')}`, { replace: true });
      return;
    }

    // Store tokens first so the axios interceptor picks them up.
    setTokens(accessToken, refreshToken);

    api
      .get('/users/me', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(({ data }) => {
        setUser(data);
        navigate('/dashboard', { replace: true });
      })
      .catch(() => {
        navigate('/login?oauthError=Could+not+load+profile', { replace: true });
      });
  }, [navigate, setTokens, setUser]);

  return (
    <div className="min-h-screen bg-ink flex flex-col items-center justify-center gap-4">
      <div className="animate-pulse">
        <VaultDial size={36} />
      </div>
      <p className="text-sm text-text-muted">Signing you in…</p>
    </div>
  );
}
