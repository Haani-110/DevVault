import { api } from '@/lib/axios';
import type { Note } from '@/types';

export interface CreateNoteInput {
  title: string;
  content?: string;
  tags?: string[];
}

export interface UpdateNoteInput {
  title?: string;
  content?: string;
  tags?: string[];
}

export const notesService = {
  /**
   * `archived` picks which half of the vault to come back: the API defaults to
   * active notes only, so asking for archived ones has to be explicit (and the
   * Archived tab does exactly that).
   */
  async list(projectId?: string, archived?: boolean): Promise<Note[]> {
    const params: Record<string, string | boolean> = {};
    if (projectId !== undefined) params.projectId = projectId;
    if (archived !== undefined) params.archived = archived;

    const { data } = await api.get('/notes', { params: Object.keys(params).length ? params : undefined });
    return data;
  },

  async create(input: CreateNoteInput): Promise<Note> {
    const { data } = await api.post('/notes', input);
    return data;
  },

  async update(id: string, input: UpdateNoteInput): Promise<Note> {
    const { data } = await api.patch(`/notes/${id}`, input);
    return data;
  },

  async togglePin(id: string): Promise<void> {
    await api.patch(`/notes/${id}/pin`);
  },

  async toggleFavorite(id: string): Promise<void> {
    await api.patch(`/notes/${id}/favorite`);
  },

  async toggleArchive(id: string): Promise<void> {
    await api.patch(`/notes/${id}/archive`);
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/notes/${id}`);
  },
};
