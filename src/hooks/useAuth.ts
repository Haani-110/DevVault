import { useAuthStore } from '@/store/authStore';
import { authService, type LoginPayload, type RegisterPayload } from '@/services/authService';
import toast from 'react-hot-toast';

export function useAuth() {
  const { user, isAuthenticated, setUser, setTokens, logout } = useAuthStore();

  async function login(payload: LoginPayload) {
    const res = await authService.login(payload);
    setUser(res.user);
    setTokens(res.accessToken, res.refreshToken);
    toast.success(`Welcome back, ${res.user.username}`);
  }

  async function register(payload: RegisterPayload) {
    const res = await authService.register(payload);
    setUser(res.user);
    setTokens(res.accessToken, res.refreshToken);
    toast.success('Account created — welcome to DevVault');
  }

  function signOut() {
    logout();
    toast('Signed out', { icon: '🔒' });
  }

  return { user, isAuthenticated, login, register, signOut };
}
