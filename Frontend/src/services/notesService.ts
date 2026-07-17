import { api } from '@/lib/axios';
import { mockNotes } from './mockData';
import type { Note } from '@/types';

const USE_MOCK = false;
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
let notes = [...mockNotes];

export interface CreateNoteInput {
  title: string;
  content?: string;
  tags?: string[];
}

export const notesService = {
  async list(): Promise<Note[]> {
    if (USE_MOCK) {
      await delay(400);
      return notes;
    }
    const { data } = await api.get('/notes');
    return data;
  },

  async create(input: CreateNoteInput): Promise<Note> {
    if (USE_MOCK) {
      await delay(300);
      const note: Note = {
        id: `note_${Date.now()}`,
        title: input.title,
        content: input.content ?? '',
        tags: input.tags ?? [],
        isPinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      notes = [note, ...notes];
      return note;
    }
    const { data } = await api.post('/notes', input);
    return data;
  },

  async togglePin(id: string): Promise<void> {
    if (USE_MOCK) {
      await delay(200);
      notes = notes.map((n) => (n.id === id ? { ...n, isPinned: !n.isPinned } : n));
      return;
    }
    await api.patch(`/notes/${id}/pin`);
  },

  async delete(id: string): Promise<void> {
    if (USE_MOCK) {
      await delay(200);
      notes = notes.filter((n) => n.id !== id);
      return;
    }
    await api.delete(`/notes/${id}`);
  },
};
