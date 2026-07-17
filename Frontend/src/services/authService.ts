import { api } from '@/lib/axios';
import type { User, AuthTokens } from '@/types';

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

export const authService = {
  async login(input: LoginInput): Promise<{ user: User } & AuthTokens> {
    const { data } = await api.post('/auth/login', input);
    return data;
  },

  async register(input: RegisterInput): Promise<{ user: User } & AuthTokens> {
    const { data } = await api.post('/auth/register', input);
    return data;
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore errors — client clears tokens regardless
    }
  },
};
