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

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.post('/auth/change-password', { currentPassword, newPassword });
  },

  /**
   * Gets a GitHub OAuth URL that safely connects GitHub to the CURRENTLY
   * logged-in account (by user id, via a signed short-lived state token) —
   * use this instead of linking directly to /auth/github when the user is
   * already signed in, since that raw sign-in route resolves by email match
   * and could create/log into a different account if the GitHub email
   * differs from the one already in use.
   */
  async getGithubLinkUrl(): Promise<{ url: string }> {
    const { data } = await api.get('/auth/github/link-url');
    return data;
  },
};
