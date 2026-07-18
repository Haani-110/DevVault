import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/axios';
import VaultDial from '@/components/ui/VaultDial';

export default function OAuthCallback() {
  const navigate = useNavigate();
  const { setUser, setTokens } = useAuthStore();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');
    const error = params.get('error');

    if (error || !accessToken || !refreshToken) {
      navigate(`/login?oauthError=${encodeURIComponent(error ?? 'Authentication failed')}`);
      return;
    }

    // Store tokens first so axios interceptor picks them up
    setTokens(accessToken, refreshToken);

    api
      .get('/users/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .then(({ data }) => {
        setUser(data);
        navigate('/dashboard', { replace: true });
      })
      .catch(() => {
        navigate('/login?oauthError=Could+not+load+profile');
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
