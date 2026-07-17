import { api } from '@/lib/axios';
import type { User } from '@/types';

export interface UpdateProfilePayload {
  username?: string;
  bio?: string;
  location?: string;
  website?: string;
  githubUrl?: string;
  linkedinUrl?: string;
}

export const userService = {
  async updateProfile(payload: UpdateProfilePayload): Promise<User> {
    const { data } = await api.patch('/users/profile', payload);
    return data;
  },

  async deleteAccount(): Promise<void> {
    await api.delete('/users/account');
  },
};
