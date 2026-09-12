import { expectApiError } from '../../test/helpers';
import { FakePrisma } from '../../test/fake-prisma';
import { ApiException } from '../common/errors/api-exception';
import { ErrorCode } from '../common/errors/error-codes';
import { NotesService } from './notes.service';

/**
 * These specs are mostly about one property: **a note belongs to exactly one
 * user, and every query has to carry that fact.** A missing `userId` filter is
 * invisible in a screenshot and obvious in a breach, so it is asserted here
 * instead of trusted.
 */
describe('NotesService', () => {
  let prisma: FakePrisma;
  let service: NotesService;

  const ALICE = 'calice0000000000000000001';
  const BOB = 'calbob0000000000000000002';

  beforeEach(() => {
    prisma = new FakePrisma();
    service = new NotesService(prisma as never);
  });

  async function createNote(userId: string, title: string) {
    return service.create(userId, { title, content: `body of ${title}` });
  }

  it('creates a note owned by the caller', async () => {
    const note = await createNote(ALICE, 'Auth refactor');

    expect(note).toMatchObject({ title: 'Auth refactor', userId: ALICE, isPinned: false, isArchived: false });
    expect(prisma.note.rows).toHaveLength(1);
  });

  it('lists only the caller’s notes', async () => {
    await createNote(ALICE, 'mine');
    await createNote(BOB, 'theirs');

    const visible = await service.list(ALICE);

    expect(visible.map((n) => n.title)).toEqual(['mine']);
  });

  it('excludes archived notes by default and returns only them when asked', async () => {
    const kept = await createNote(ALICE, 'kept');
    const archived = await createNote(ALICE, 'done with');
    await service.toggleArchive(ALICE, archived.id);

    expect((await service.list(ALICE)).map((n) => n.id)).toEqual([kept.id]);
    expect((await service.list(ALICE, { archived: true })).map((n) => n.id)).toEqual([archived.id]);
  });

  it('sorts pinned notes first', async () => {
    const plain = await createNote(ALICE, 'plain');
    const pinned = await createNote(ALICE, 'pinned');
    await service.togglePin(ALICE, pinned.id);

    expect((await service.list(ALICE)).map((n) => n.id)).toEqual([pinned.id, plain.id]);
  });

  it('filters by project, and treats an empty projectId as "no project"', async () => {
    const project = await prisma.project.create({ data: { userId: ALICE, name: 'Frontend' } });
    const inProject = await prisma.note.create({
      data: { userId: ALICE, title: 'in', content: 'x', projectId: project.id },
    });
    const loose = await createNote(ALICE, 'loose');

    expect((await service.list(ALICE, { projectId: project.id })).map((n) => n.id)).toEqual([inProject.id]);
    expect((await service.list(ALICE, { projectId: '' })).map((n) => n.id)).toEqual([loose.id]);
  });

  it('updates a note of the caller without touching fields the dto omits', async () => {
    const note = await createNote(ALICE, 'before');
    await service.togglePin(ALICE, note.id);

    const updated = await service.update(ALICE, note.id, { title: 'after' });

    expect(updated).toMatchObject({ title: 'after', content: 'body of before', isPinned: true });
  });

  it.each([
    ['update', (id: string) => service.update(BOB, id, { title: 'hijacked' })],
    ['toggle pin', (id: string) => service.togglePin(BOB, id)],
    ['toggle favorite', (id: string) => service.toggleFavorite(BOB, id)],
    ['toggle archive', (id: string) => service.toggleArchive(BOB, id)],
    ['delete', (id: string) => service.remove(BOB, id)],
  ])('answers 404 — not 403 — when someone else tries to %s a note', async (_label, act) => {
    const note = await createNote(ALICE, 'private');

    await expectApiError(act(note.id), 404, ErrorCode.NOTE_NOT_FOUND);
    // …and the row is untouched.
    expect(prisma.note.rows[0]).toMatchObject({ title: 'private', isPinned: false, isArchived: false });
  });

  it('does not reveal that an id exists when it belongs to someone else', async () => {
    const note = await createNote(ALICE, 'private');

    const asMissing = await service.remove(BOB, 'c0000000000000000000000zz').catch((err) => err);
    const asForeign = await service.remove(BOB, note.id).catch((err) => err);

    // `getResponse()` is the whole body the client sees. It has to be identical
    // for "no such note" and "a note you may not have", or every id in the
    // system becomes a probe for whether someone else owns it.
    expect((asMissing as ApiException).getResponse()).toEqual((asForeign as ApiException).getResponse());
  });

  it('deletes only the caller’s own note', async () => {
    const mine = await createNote(ALICE, 'mine');
    const theirs = await createNote(BOB, 'theirs');

    await service.remove(ALICE, mine.id);

    expect(prisma.note.rows.map((n) => n.title)).toEqual(['theirs']);
    expect(theirs).toBeTruthy();
  });
});
