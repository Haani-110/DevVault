import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setUser: (user: User) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      setUser: (user) => set({ user }),
      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken, isAuthenticated: true }),
      logout: () =>
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false }),
    }),
    {
      name: 'devvault-auth',
      version: 2,
      // Clear any state that has a mock token — leftover from USE_MOCK era
      migrate: (state: unknown, version: number) => {
        if (version < 2) {
          const s = state as Partial<AuthState>;
          if (
            s.accessToken?.startsWith('mock-') ||
            s.refreshToken?.startsWith('mock-')
          ) {
            return { user: null, accessToken: null, refreshToken: null, isAuthenticated: false };
          }
        }
        return state as AuthState;
      },
    }
  )
);
