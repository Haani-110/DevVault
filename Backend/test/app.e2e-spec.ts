import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app-setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { FakePrisma } from './fake-prisma';

/**
 * The HTTP layer, end to end: routing under the `/api/v1` prefix, guards,
 * `ValidationPipe` (including `forbidNonWhitelisted`), ownership scoping and the
 * exact error body every client is written against.
 *
 * Prisma is replaced by `FakePrisma`, so this suite needs no database — and, in
 * exchange, proves nothing about SQL. See `test/fake-prisma.ts`.
 */
describe('DevVault API (e2e)', () => {
  let app: INestApplication;
  let prisma: FakePrisma;
  let accessToken: string;
  let refreshToken: string;

  const ALICE = { email: 'alice@example.com', username: 'alice', password: 'hunter22hunter22' };

  beforeAll(async () => {
    prisma = new FakePrisma();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    prisma.reset();
    const { body } = await call(http().post('/api/v1/auth/register').send(ALICE), 201);
    accessToken = body.accessToken;
    refreshToken = body.refreshToken;
  });

  const server = () => app.getHttpServer();
  const http = () => request(server());
  /** Defaults to the signed-in user's token; pass another to test cross-account access. */
  const auth = (token: string = accessToken) => ({ Authorization: `Bearer ${token}` });

  /**
   * Sends a request and asserts on it with jest matchers.
   *
   * supertest's own `.expect(status, body)` does a strict deep-equal, which
   * silently ignores `expect.objectContaining`/`expect.any` — so the body check
   * has to live on the jest side of the line to be worth anything.
   */
  async function call(make: request.Test, status?: number, body?: unknown) {
    const res = await make;

    if (status !== undefined) expect(res.status).toBe(status);
    if (body !== undefined) expect(res.body).toMatchObject(body as object);

    return res;
  }

  /** The error body contract: `code` for machines, `message` for humans. */
  const errorBody = (statusCode: number, code: string) => ({
    statusCode,
    code,
    message: expect.any(String),
    path: expect.any(String),
    timestamp: expect.any(String),
  });

  describe('health', () => {
    it('reports the API and the database separately', async () => {
      await call(http().get('/api/v1/health'), 200, {
        status: 'ok',
        database: 'up',
        uptimeSeconds: expect.any(Number),
        timestamp: expect.any(String),
      });
    });

    it('says degraded, with a 503, when the database cannot be reached', async () => {
      const probe = prisma.$queryRaw;
      prisma.$queryRaw = (async () => {
        throw new Error('connect ECONNREFUSED postgres.internal:5432');
      }) as never;

      const res = await call(http().get('/api/v1/health'), 503, { status: 'degraded', database: 'down' });
      // Whatever the driver said, the response body must not repeat it.
      expect(JSON.stringify(res.body)).not.toMatch(/ECONNREFUSED|postgres/);

      prisma.$queryRaw = probe;
    });
  });

  describe('POST /auth/register', () => {
    it('rejects a short password and names the field', async () => {
      const res = await call(
        http().post('/api/v1/auth/register').send({ email: 'bob@example.com', username: 'bob', password: 'short' }),
        400,
        errorBody(400, 'VALIDATION_FAILED'),
      );

      expect((res.body.details as string[]).join(' ')).toMatch(/password must be at least 8 characters/i);
    });

    it('normalizes the email so case and spaces cannot create two accounts', async () => {
      await call(
        http().post('/api/v1/auth/register').send({ ...ALICE, email: '  ALICE@Example.COM ' }),
        409,
        { code: 'EMAIL_ALREADY_REGISTERED' },
      );
    });

    it('refuses a field the DTO does not declare instead of ignoring it', async () => {
      const res = await call(
        http().post('/api/v1/auth/register').send({ email: 'carol@example.com', username: 'carol', password: 'longenough123', role: 'ADMIN' }),
        400,
        { code: 'VALIDATION_FAILED' },
      );

      expect(res.body.message).toMatch(/role/);
      // …and the account that would have been created is not there either.
      expect(prisma.user.rows.map((row) => row.email)).toEqual([ALICE.email]);
    });

    it('stores a hash, not the password', () => {
      expect(prisma.user.rows[0].passwordHash).toBeTruthy();
      expect(prisma.user.rows[0].passwordHash).not.toContain(ALICE.password);
    });
  });

  describe('POST /auth/login', () => {
    it('answers 200, not 201, and returns a usable pair', async () => {
      const res = await call(http().post('/api/v1/auth/login').send({ email: ALICE.email, password: ALICE.password }), 200);

      await call(http().get('/api/v1/users/me').set(auth(res.body.accessToken)), 200, { email: ALICE.email });
    });

    it('does not distinguish a wrong password from an unknown account', async () => {
      const wrong = await call(http().post('/api/v1/auth/login').send({ email: ALICE.email, password: 'nope-nope-nope' }), 401);
      const unknown = await call(http().post('/api/v1/auth/login').send({ email: 'nobody@example.com', password: ALICE.password }), 401);

      // Compared field by field, because `timestamp` differs by a few ms — the
      // point of the test is that nothing *else* differs.
      expect({ ...wrong.body, timestamp: 0 }).toEqual({ ...unknown.body, timestamp: 0 });
      expect(wrong.body).toMatchObject(errorBody(401, 'INVALID_CREDENTIALS'));
    });

    it('will not accept a refresh token as a password', async () => {
      const res = await call(http().post('/api/v1/auth/login').send({ email: ALICE.email, password: refreshToken }));

      // Either answer is a rejection, and both are correct: 400 because the DTO
      // caps passwords at 128 characters (bcrypt cost has to be bounded
      // somewhere), 401 if a shorter credential is tried. What matters is that
      // neither one returns a token.
      expect([400, 401]).toContain(res.status);
      expect(res.body).not.toHaveProperty('accessToken');
    });
  });

  describe('POST /auth/refresh', () => {
    it('accepts a refresh token and refuses an access token', async () => {
      await call(http().post('/api/v1/auth/refresh').send({ refreshToken }), 200);
      await call(http().post('/api/v1/auth/refresh').send({ refreshToken: accessToken }), 401, { code: 'INVALID_REFRESH_TOKEN' });
    });
  });

  describe('GET /users/me', () => {
    it('requires a token', () => call(http().get('/api/v1/users/me'), 401, { code: 'UNAUTHORIZED' }));

    it('returns the profile and nothing secret', async () => {
      const res = await call(http().get('/api/v1/users/me').set(auth()), 200, { email: ALICE.email, username: ALICE.username, role: 'USER' });

      for (const forbidden of ['passwordHash', 'password', 'passwordChangedAt']) {
        expect(res.body).not.toHaveProperty(forbidden);
      }
    });

    it('rejects a token signed with the refresh secret', () =>
      call(http().get('/api/v1/users/me').set({ Authorization: `Bearer ${refreshToken}` }), 401));
  });

  describe('notes', () => {
    const createNote = (title: string, extra: Record<string, unknown> = {}) =>
      http().post('/api/v1/notes').set(auth()).send({ title, content: `body of ${title}`, ...extra });

    it('creates, lists and updates within the caller', async () => {
      const { body } = await call(createNote('Auth refactor'), 201);
      expect(body).toMatchObject({ title: 'Auth refactor', userId: prisma.user.rows[0].id });

      await call(http().get('/api/v1/notes').set(auth()), 200, [expect.objectContaining({ id: body.id })]);
      await call(http().patch(`/api/v1/notes/${body.id}`).set(auth()).send({ title: 'Auth refactor v2' }), 200);
      expect(prisma.note.rows[0].title).toBe('Auth refactor v2');
    });

    it('splits active from archived across two queries', async () => {
      const { body } = await call(createNote('old thing'), 201);
      await call(http().patch(`/api/v1/notes/${body.id}/archive`).set(auth()), 204);

      await call(http().get('/api/v1/notes').set(auth()), 200, []);
      await call(http().get('/api/v1/notes?archived=true').set(auth()), 200, [expect.objectContaining({ id: body.id })]);
    });

    it('rejects a tag list that is too long, so the column cannot overflow', () =>
      call(createNote('too many tags', { tags: Array.from({ length: 21 }, (_v, i) => `tag${i}`) }), 400, { code: 'VALIDATION_FAILED' }));

    it('rejects an unknown query parameter rather than silently ignoring it', () =>
      call(http().get('/api/v1/notes?archvied=true').set(auth()), 400, { code: 'VALIDATION_FAILED' }));

    it('refuses someone else’s note with the same answer as a missing one', async () => {
      const { body } = await call(createNote('private'), 201);
      const bob = await call(
        http().post('/api/v1/auth/register').send({ email: 'bob@example.com', username: 'bob', password: 'bobbobbob123' }),
        201,
      );

      const asForeign = await call(
        http().patch(`/api/v1/notes/${body.id}`).set(auth(bob.body.accessToken)).send({ title: 'mine now' }),
        404,
        { code: 'NOTE_NOT_FOUND' },
      );
      const asMissing = await call(http().patch('/api/v1/notes/c0000000000000000000000zz').set(auth(bob.body.accessToken)).send({ title: 'x' }), 404);

      // Same answer either way: an id cannot be probed for existence.
      expect(asMissing.body).toMatchObject({ code: asForeign.body.code, statusCode: 404 });
      expect(prisma.note.rows[0].title).toBe('private');
    });

    it('rejects an id that is not an id, without asking the database', () =>
      call(http().patch('/api/v1/notes/1%20OR%201%3D1').set(auth()).send({ title: 'x' }), 400, { code: 'VALIDATION_FAILED' }));
  });

  describe('projects', () => {
    it('creates one and lists only the caller’s', async () => {
      await call(http().post('/api/v1/projects').set(auth()).send({ name: 'DevVault', color: '#22c55e' }), 201);
      await call(http().post('/api/v1/projects').send({ name: 'someone elses' }), 401);

      await call(http().get('/api/v1/projects').set(auth()), 200, [
        expect.objectContaining({ name: 'DevVault', color: '#22c55e', taskCount: 0, completedCount: 0 }),
      ]);
    });

    it('requires a real hex colour', () =>
      call(http().post('/api/v1/projects').set(auth()).send({ name: 'DevVault', color: 'green' }), 400, { code: 'VALIDATION_FAILED' }));
  });

  describe('import', () => {
    it('tells the user to connect GitHub first, as a 400 with a code', async () => {
      const res = await call(http().post('/api/v1/import/github').set(auth()).send({ owner: 'octo', repo: 'app' }), 400);

      expect(res.body).toMatchObject(errorBody(400, 'GITHUB_NOT_CONNECTED'));
      expect(res.body.message).toMatch(/connect your github account/i);
    });

    it('rejects a repository name that GitHub would never accept', () =>
      call(http().post('/api/v1/import/github').set(auth()).send({ owner: 'oc to/../', repo: 'ap p' }), 400, { code: 'VALIDATION_FAILED' }));

    it('answers “no job yet” rather than 404, so a modal can resume without guessing', async () => {
      await call(http().get('/api/v1/import/github/jobs/latest').set(auth()), 200, { job: null });
    });

    it('404s a job id that is not the caller’s', async () => {
      const job = await prisma.importJob.create({
        data: { userId: 'csomeoneelse0000000000001', repoOwner: 'octo', repoName: 'app', repoFullName: 'octo/app', status: 'PROCESSING' },
      });

      await call(http().get(`/api/v1/import/github/jobs/${job.id}`).set(auth()), 404, { code: 'IMPORT_JOB_NOT_FOUND' });
    });
  });

  describe('account deletion', () => {
    it('removes the user and everything owned by them', async () => {
      await call(http().post('/api/v1/notes').set(auth()).send({ title: 'doomed', content: 'x' }), 201);
      await call(http().delete('/api/v1/users/account').set(auth()), 204);

      expect(prisma.user.rows).toHaveLength(0);
      expect(prisma.note.rows).toHaveLength(0);
      await call(http().get('/api/v1/users/me').set(auth()), 401);
    });
  });

  describe('unknown routes', () => {
    it('answer in the same shape as everything else', async () => {
      const res = await call(http().get('/api/v1/does-not-exist').set(auth()), 404);

      // Nest routes an unmatched path through the exception filter too, so even
      // this arrives with a `code` — clients never have to special-case it.
      expect(res.body).toMatchObject(errorBody(404, 'NOT_FOUND_GENERIC'));
      expect(res.body.message).toMatch(/Cannot GET/);
    });
  });
});
