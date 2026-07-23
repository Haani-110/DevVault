import { api } from '@/lib/axios';
import type { Snippet } from '@/types';

export interface CreateSnippetInput {
  title: string;
  description?: string;
  code: string;
  language?: string;
  tags?: string[];
}

export interface UpdateSnippetInput {
  title?: string;
  description?: string;
  code?: string;
  language?: string;
  tags?: string[];
}

export const snippetsService = {
  async list(projectId?: string): Promise<Snippet[]> {
    const { data } = await api.get('/snippets', { params: projectId !== undefined ? { projectId } : undefined });
    return data;
  },

  async create(input: CreateSnippetInput): Promise<Snippet> {
    const { data } = await api.post('/snippets', input);
    return data;
  },

  async update(id: string, input: UpdateSnippetInput): Promise<Snippet> {
    const { data } = await api.patch(`/snippets/${id}`, input);
    return data;
  },

  async toggleFavorite(id: string): Promise<Snippet> {
    const { data } = await api.patch(`/snippets/${id}/favorite`);
    return data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/snippets/${id}`);
  },
};
