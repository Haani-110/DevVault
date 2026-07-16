import { mockNotes } from './mockData';
import type { Note } from '@/types';

const USE_MOCK = false;
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
let notes = [...mockNotes];

export const notesService = {
  async list(): Promise<Note[]> {
    if (USE_MOCK) {
      await delay(400);
      return [...notes].sort((a, b) => Number(b.isPinned) - Number(a.isPinned));
    }
    const { api } = await import('@/lib/axios');
    const { data } = await api.get('/notes');
    return data;
  },

  async create(input: Pick<Note, 'title' | 'content' | 'tags'>): Promise<Note> {
    if (USE_MOCK) {
      await delay(300);
      const note: Note = {
        id: `note_${Date.now()}`,
        isPinned: false,
        isFavorite: false,
        isArchived: false,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        ...input,
      };
      notes = [note, ...notes];
      return note;
    }
    const { api } = await import('@/lib/axios');
    const { data } = await api.post('/notes', input);
    return data;
  },

  async togglePin(id: string): Promise<void> {
    if (USE_MOCK) {
      await delay(150);
      notes = notes.map((n) => (n.id === id ? { ...n, isPinned: !n.isPinned } : n));
      return;
    }
    const { api } = await import('@/lib/axios');
    await api.patch(`/notes/${id}/pin`);
  },

  async remove(id: string): Promise<void> {
    if (USE_MOCK) {
      await delay(200);
      notes = notes.filter((n) => n.id !== id);
      return;
    }
    const { api } = await import('@/lib/axios');
    await api.delete(`/notes/${id}`);
  },
};
