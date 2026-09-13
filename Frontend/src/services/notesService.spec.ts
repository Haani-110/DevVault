import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get } = vi.hoisted(() => ({ get: vi.fn(async () => ({ data: [] as unknown[] })) }));

vi.mock('@/lib/axios', () => ({ api: { get } }));

import { notesService } from '@/services/notesService';

/**
 * The query string is the contract, so it gets a test.
 *
 * The Notes page's Archived tab used to ask for all notes and filter
 * `isArchived` on the client — which read as "the vault is empty" for anyone
 * with archived notes, because the API only returns them when asked. Both tabs
 * now state which half they want; the explicit `archived: false` is what keeps
 * the two react-query cache keys distinct.
 */
describe('notesService.list', () => {
  beforeEach(() => {
    get.mockClear();
  });

  it('sends no params when nothing is filtered', async () => {
    await notesService.list();
    expect(get).toHaveBeenCalledWith('/notes', { params: undefined });
  });

  it('scopes to a project', async () => {
    await notesService.list('proj_1');
    expect(get).toHaveBeenCalledWith('/notes', { params: { projectId: 'proj_1' } });
  });

  it('asks the API for archived notes', async () => {
    await notesService.list(undefined, true);
    expect(get).toHaveBeenCalledWith('/notes', { params: { archived: true } });
  });

  it('asks the API for active notes, rather than filtering afterwards', async () => {
    await notesService.list(undefined, false);
    expect(get).toHaveBeenCalledWith('/notes', { params: { archived: false } });
  });

  it('combines a project and the archive flag', async () => {
    await notesService.list('proj_1', true);
    expect(get).toHaveBeenCalledWith('/notes', { params: { projectId: 'proj_1', archived: true } });
  });
});
