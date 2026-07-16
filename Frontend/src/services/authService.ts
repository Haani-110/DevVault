import { mockUser } from './mockData';
import type { User } from '@/types';

const USE_MOCK = false;

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  username: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export const authService = {
  async login(payload: LoginPayload): Promise<AuthResponse> {
    if (USE_MOCK) {
      await delay(600);
      if (!payload.email || payload.password.length < 6) {
        throw new Error('Invalid email or password');
      }
      return {
        user: { ...mockUser, email: payload.email },
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      };
    }
    const { data } = await import('@/lib/axios').then((m) => m.api.post('/auth/login', payload));
    return data;
  },

  async register(payload: RegisterPayload): Promise<AuthResponse> {
    if (USE_MOCK) {
      await delay(700);
      return {
        user: { ...mockUser, email: payload.email, username: payload.username },
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      };
    }
    const { data } = await import('@/lib/axios').then((m) => m.api.post('/auth/register', payload));
    return data;
  },
};
