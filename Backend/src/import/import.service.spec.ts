import { ImportJobStatus, ImportStage } from '@prisma/client';
import { FakePrisma } from '../../test/fake-prisma';
import { expectApiError } from '../../test/helpers';
import { ErrorCode } from '../common/errors/error-codes';
import { TokenCryptoService } from '../common/security/token-crypto.service';
import { ImportService } from './import.service';

const USER = 'cimporter00000000000000001';
const OTHER_USER = 'cotheruser000000000000002';
const REPO = {
  full_name: 'octo/app',
  name: 'app',
  description: 'The app',
  default_branch: 'main',
  owner: { login: 'octo' },
};

/** `fetch` shaped like the handful of GitHub endpoints the importer calls. */
function mockGithub({
  tree = [],
  blobs = {},
  repo = REPO,
  repoStatus = 200,
  treeStatus = 200,
  hangOn,
}: {
  tree?: unknown[];
  blobs?: Record<string, { body?: string | null; status?: number }>;
  repo?: unknown;
  repoStatus?: number;
  treeStatus?: number;
  /** Requests whose URL contains this string never resolve — a stalled upstream. */
  hangOn?: string;
}) {
  const urls: string[] = [];

  global.fetch = jest.fn(async (input: string) => {
    urls.push(input);
    if (hangOn && input.includes(hangOn)) return new Promise(() => undefined);
    const respond = (status: number, payload: unknown) => ({
      ok: status >= 200 && status < 300,
      status,
      headers: { get: () => null },
      json: async () => payload,
      text: async () => JSON.stringify(payload),
    });

    if (input.includes('/git/trees/')) return respond(treeStatus, { tree, truncated: false });
    if (input.includes('/git/blobs/')) {
      const sha = input.slice(input.lastIndexOf('/blobs/') + 7);
      const blob = blobs[sha];
      if (!blob || blob.status) return respond(blob?.status ?? 500, { message: 'no such blob' });
      return respond(200, { encoding: 'base64', content: Buffer.from(blob.body ?? '', 'utf8').toString('base64') });
    }
    if (/\/repos\/[^/]+\/[^/]+$/.test(input)) return respond(repoStatus, repo);

    throw new Error(`unexpected GitHub URL in test: ${input}`);
  }) as never;

  return urls;
}

const sourceFile = (path: string, sha: string, size = 400) => ({ path, type: 'blob', sha, size });
const directory = (path: string) => ({ path, type: 'tree', sha: 't' });

describe('ImportService', () => {
  let prisma: FakePrisma;
  let tokenCrypto: TokenCryptoService;
  let ai: { isConfigured: boolean; analyzeRepoFiles: jest.Mock };
  let service: ImportService;

  beforeEach(async () => {
    jest.useFakeTimers();

    prisma = new FakePrisma();
    tokenCrypto = new TokenCryptoService();
    await prisma.oAuthAccount.create({
      data: {
        userId: USER,
        provider: 'github',
        providerUid: '1',
        accessToken: tokenCrypto.encrypt('ghp_test_token'),
        refreshToken: null,
      },
    });

    ai = { isConfigured: true, analyzeRepoFiles: jest.fn().mockResolvedValue({ notes: [], snippets: [], tasks: [] }) };
    service = new ImportService(prisma as never, ai as never, tokenCrypto);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const start = (dto = { owner: 'octo', repo: 'app' }) => service.startImport(USER, dto as never);

  /**
   * Runs the background job to its end under fake timers: the pipeline is
   * allowed to sleep (GitHub retries, the whole-job deadline), so time is
   * advanced in steps until the job reports itself idle.
   */
  const runToEnd = async (limitMs = 60_000) => {
    const idle = service.whenIdle();

    for (let elapsed = 0; elapsed < limitMs; elapsed += 500) {
      const finished = await Promise.race([
        idle.then(() => true),
        jest.advanceTimersByTimeAsync(500).then(() => false),
      ]);
      if (finished) return;
    }

    throw new Error('the import never reached a terminal state');
  };

  it('refuses to start when the account has no GitHub connection', async () => {
    prisma.oAuthAccount.rows.length = 0;

    await expectApiError(start(), 400, ErrorCode.GITHUB_NOT_CONNECTED);
    expect(prisma.importJob.rows).toHaveLength(0);
  });

  it('refuses to start when the stored token cannot be decrypted', async () => {
    prisma.oAuthAccount.rows[0].accessToken = 'v1:not:enough:parts:here';

    await expectApiError(start(), 400, ErrorCode.GITHUB_TOKEN_EXPIRED);
  });

  it('refuses to start when AI analysis is not configured, so no job is left dangling', async () => {
    ai.isConfigured = false;

    await expectApiError(start(), 500, ErrorCode.AI_NOT_CONFIGURED);
    expect(prisma.importJob.rows).toHaveLength(0);
  });

  it('refuses a second import while one is in flight, and names the job that is', async () => {
    const job = await prisma.importJob.create({
      data: { userId: USER, repoOwner: 'octo', repoName: 'other', repoFullName: 'octo/other', status: 'PROCESSING' },
    });

    const error = await start().catch((e) => e);

    expect(error.code).toBe(ErrorCode.IMPORT_ALREADY_RUNNING);
    expect(error.message).toContain('octo/other');
    expect((error.getResponse() as { details?: unknown }).details).toEqual({ jobId: job.id });
  });

  it('reports a different user’s running import as no obstacle to theirs', async () => {
    await prisma.importJob.create({
      data: { userId: OTHER_USER, repoOwner: 'octo', repoName: 'app', repoFullName: 'octo/app', status: 'PROCESSING' },
    });
    mockGithub({ tree: [sourceFile('src/index.ts', 'sha1')] });

    await expect(start()).resolves.toHaveProperty('jobId');
  });

  it('checks the repository before accepting the job, so a typo is an immediate error', async () => {
    const urls = mockGithub({ repo: { message: 'Not Found' }, repoStatus: 404 });

    const error = await start().catch((e) => e);

    expect(error.code).toBe(ErrorCode.REPOSITORY_NOT_FOUND);
    expect(error.message).toMatch(/check the owner and name/i);
    // …and nothing was queued: the failure is the response, not a job that dies
    // a second later with the same message in a column nobody reads.
    expect(prisma.importJob.rows).toHaveLength(0);
    expect(urls).toHaveLength(1);
  });

  it('accepts the job with the repository resolved, then returns immediately', async () => {
    mockGithub({ tree: [sourceFile('src/index.ts', 'sha1')], blobs: { sha1: { body: 'export const a = 1;' } } });

    const { jobId } = await start();
    const job = prisma.importJob.rows.find((row) => row.id === jobId);

    expect(jobId).toMatch(/^c/);
    // The job begins on the next microtask, so either of the two "not finished"
    // states is correct to observe here — the point is that the row exists, is
    // the caller's, and carries the repository GitHub confirmed.
    expect(job).toMatchObject({ userId: USER, repoFullName: 'octo/app', branch: 'main' });
    expect([ImportJobStatus.PENDING, ImportJobStatus.PROCESSING]).toContain(job?.status);
  });

  it('sends the decrypted GitHub token, and only to GitHub', async () => {
    const urls = mockGithub({ tree: [sourceFile('src/index.ts', 'sha1')], blobs: { sha1: { body: 'x' } } });
    await start();
    await runToEnd();

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer ghp_test_token');
    expect(JSON.stringify(init.headers)).not.toContain('v1:');
    expect(urls.every((url) => url.startsWith('https://api.github.com'))).toBe(true);
  });

  it('runs the pipeline to completion and stores the result with its provenance', async () => {
    mockGithub({
      tree: [
        sourceFile('src/index.ts', 'sha1'),
        sourceFile('src/util.ts', 'sha2'),
      ],
      blobs: { sha1: { body: 'export const a = 1;' }, sha2: { body: 'export const b = 2;' } },
    });
    ai.analyzeRepoFiles.mockResolvedValue({
      notes: [{ title: 'Index', content: 'Entry point.', tags: ['entry'], sourcePath: 'src/index.ts' }],
      snippets: [{ title: 'Util', description: 'Small helper', code: 'export const b = 2;', language: 'typescript', tags: ['util'], sourcePath: 'src/util.ts' }],
      tasks: [{ title: 'Finish it', description: 'TODO in index', status: 'IN_PROGRESS', priority: 'HIGH', sourcePath: 'src/index.ts' }],
    });

    const { jobId } = await start();
    await runToEnd();

    const job = prisma.importJob.rows[0];
    expect(job).toMatchObject({
      status: ImportJobStatus.COMPLETED,
      stage: ImportStage.COMPLETED,
      progress: 100,
      filesAnalyzed: 2,
      notesCreated: 1,
      snippetsCreated: 1,
      tasksCreated: 1,
      error: null,
      warning: null,
    });

    const project = prisma.project.rows[0];
    expect(project).toMatchObject({ userId: USER, name: 'app', description: 'The app', sourceRepo: 'octo/app' });
    expect(job.projectId).toBe(project.id);

    expect(prisma.note.rows[0]).toMatchObject({
      projectId: project.id,
      generatedByAI: true,
      importJobId: jobId,
      sourcePath: 'src/index.ts',
    });
    expect(prisma.snippet.rows[0].sourcePath).toBe('src/util.ts');
    expect(prisma.task.rows[0]).toMatchObject({ status: 'IN_PROGRESS', priority: 'HIGH' });
  });

  it('filters out dependencies, build output, lockfiles and binaries before reading anything', async () => {
    const urls = mockGithub({
      tree: [
        directory('node_modules'),
        sourceFile('node_modules/vite/index.js', 'nm'),
        sourceFile('dist/app.js', 'dist'),
        sourceFile('package-lock.json', 'lock'),
        sourceFile('assets/logo.png', 'png'),
        sourceFile('src/generated/client.d.ts', 'dts'),
        sourceFile('src/index.min.js', 'min'),
        sourceFile('src/index.ts', 'real', 90),
        sourceFile('assets/huge.bin', 'huge', 500_000),
      ],
      blobs: { real: { body: 'export const a = 1;' } },
    });

    const { jobId } = await start();
    await runToEnd();

    expect(urls.filter((url) => url.includes('/git/blobs/'))).toHaveLength(1);
    expect(prisma.importJob.rows[0]).toMatchObject({ id: jobId, totalFiles: 1, status: ImportJobStatus.COMPLETED });
    expect(ai.analyzeRepoFiles).toHaveBeenCalledTimes(1);
  });

  it('truncates a file to the analysis budget instead of trusting GitHub', async () => {
    mockGithub({ tree: [sourceFile('src/big.ts', 'big', 100)], blobs: { big: { body: 'a'.repeat(50_000) } } });

    await start();
    await runToEnd();

    const [[, files]] = ai.analyzeRepoFiles.mock.calls as unknown as [[string, { content: string }[]]];
    expect(files[0].content).toHaveLength(8_000);
  });

  it('keeps the files it could read and warns about the ones it could not', async () => {
    mockGithub({
      tree: [sourceFile('src/ok.ts', 'ok'), sourceFile('src/gone.ts', 'gone')],
      blobs: { ok: { body: 'export const ok = 1;' }, gone: { status: 500 } },
    });

    await start();
    await runToEnd();

    const job = prisma.importJob.rows[0];
    expect(job.status).toBe(ImportJobStatus.COMPLETED);
    expect(job.warning).toContain('1 file(s) could not be read');
  });

  it('fails with a specific reason when the repository has nothing to analyze', async () => {
    mockGithub({ tree: [directory('docs'), sourceFile('README', 'readme', 0)] });

    await start();
    await runToEnd();

    expect(prisma.importJob.rows[0]).toMatchObject({
      status: ImportJobStatus.FAILED,
      stage: ImportStage.FAILED,
      error: expect.stringMatching(/no analyzable source files/i) as unknown as string,
    });
    expect(ai.analyzeRepoFiles).not.toHaveBeenCalled();
  });

  it('passes the whole repository to the model as several batches, then keeps the good ones', async () => {
    const big = 'x'.repeat(9_000);
    mockGithub({
      tree: [sourceFile('src/a.ts', 'a', 9_000), sourceFile('src/b.ts', 'b', 9_000)],
      blobs: { a: { body: big }, b: { body: big } },
    });
    ai.analyzeRepoFiles
      .mockResolvedValueOnce({ notes: [{ title: 'A', content: 'a', tags: [] }], snippets: [], tasks: [] })
      .mockRejectedValueOnce(new Error('upstream 503'));

    await start();
    await runToEnd();

    expect(ai.analyzeRepoFiles).toHaveBeenCalledTimes(2);
    const job = prisma.importJob.rows[0];
    expect(job).toMatchObject({ status: ImportJobStatus.COMPLETED, notesCreated: 1, totalBatches: 2 });
    expect(job.warning).toMatch(/1 of 2 analysis batches failed/);
  });

  it('fails the job when no batch could be analyzed', async () => {
    mockGithub({ tree: [sourceFile('src/a.ts', 'a')], blobs: { a: { body: 'export const a = 1;' } } });
    ai.analyzeRepoFiles.mockRejectedValue(new Error('Groq API returned 503'));

    await start();
    await runToEnd();

    expect(prisma.importJob.rows[0]).toMatchObject({
      status: ImportJobStatus.FAILED,
      error: 'The AI service could not analyze any part of this repository. Please try again in a minute.',
    });
  });

  it('stores a generic failure message for an error it did not expect', async () => {
    mockGithub({ tree: [sourceFile('src/a.ts', 'a')], blobs: { a: { body: 'export const a = 1;' } } });
    ai.analyzeRepoFiles.mockResolvedValue({ notes: [{ title: 'A', content: 'a', tags: [] }], snippets: [], tasks: [] });
    prisma.project.create = (() => {
      throw new Error('connect ECONNREFUSED postgres.internal:5432 password=hunter2');
    }) as never;

    await start();
    await runToEnd();

    const job = prisma.importJob.rows[0];
    expect(job.status).toBe(ImportJobStatus.FAILED);
    expect(job.error).toBe('The import stopped unexpectedly. Please try again.');
    expect(job.error).not.toMatch(/postgres|ECONNREFUSED|hunter2/);
  });

  it('stops a job that never finishes instead of leaving it in progress forever', async () => {
    // The blob request hangs, so the pipeline sits inside the fetch forever.
    mockGithub({ tree: [sourceFile('src/a.ts', 'a')], blobs: { a: { body: 'x' } }, hangOn: '/git/blobs/' });

    await start();
    await runToEnd(12 * 60_000);

    expect(prisma.importJob.rows[0]).toMatchObject({
      status: ImportJobStatus.FAILED,
      error: expect.stringMatching(/exceeded the 10 minute limit/) as unknown as string,
    });
  });

  it('records progress the client can poll, without one write per file', async () => {
    const files = Array.from({ length: 24 }, (_v, i) => sourceFile(`src/f${i}.ts`, `sha${i}`, 200));
    const blobs = Object.fromEntries(files.map((_f, i) => [`sha${i}`, { body: `export const v${i} = 1;` }]));
    mockGithub({ tree: files, blobs });

    const updates: Record<string, unknown>[] = [];
    const realUpdate = prisma.importJob.update.bind(prisma.importJob);
    prisma.importJob.update = ((args: { where: unknown; data: Record<string, unknown> }) => {
      updates.push(args.data);
      return realUpdate(args as never);
    }) as never;

    const { jobId } = await start();
    const poll = await service.getJobStatus(USER, jobId);
    // The pipeline starts on the next microtask, so either state is correct here;
    // what matters is that a poll while it runs is answered from the row, not
    // from process memory.
    expect(['PENDING', 'PROCESSING']).toContain(poll.status);
    expect(poll).toMatchObject({ jobId, progress: 5, totalFiles: 0 });

    await runToEnd();

    // 24 files, and the only writes are the stage transitions and the flushes at
    // their boundaries — not one per file.
    expect(updates.length).toBeLessThan(12);
    expect(updates.some((data) => typeof data.stageLabel === 'string' && /Reading/.test(String(data.stageLabel)))).toBe(true);
  });

  describe('job reads', () => {
    it('returns a job to its owner, and 404s for anyone else', async () => {
      const job = await prisma.importJob.create({
        data: { userId: USER, repoOwner: 'octo', repoName: 'app', repoFullName: 'octo/app', status: 'COMPLETED', stage: 'COMPLETED' },
      });

      await expect(service.getJobStatus(USER, job.id)).resolves.toMatchObject({ jobId: job.id, status: 'COMPLETED' });
      await expectApiError(service.getJobStatus(OTHER_USER, job.id), 404, ErrorCode.IMPORT_JOB_NOT_FOUND);
      await expectApiError(service.getJobStatus(USER, 'c0000000000000000000000zz'), 404, ErrorCode.IMPORT_JOB_NOT_FOUND);
    });

    it('only reports a result once the job has finished', async () => {
      const project = await prisma.project.create({ data: { userId: USER, name: 'app', sourceRepo: 'octo/app' } });
      const running = await prisma.importJob.create({
        data: { userId: USER, repoOwner: 'octo', repoName: 'app', repoFullName: 'octo/app', status: 'PROCESSING', projectId: project.id },
      });

      expect((await service.getJobStatus(USER, running.id)).result).toBeNull();

      await prisma.importJob.update({ where: { id: running.id }, data: { status: 'COMPLETED' } });
      expect(await service.getJobStatus(USER, running.id)).toMatchObject({
        result: { project: { id: project.id, name: 'app', sourceRepo: 'octo/app' }, notesCreated: 0 },
      });
    });

    it('offers the most recent job so a reload can resume it', async () => {
      await prisma.importJob.create({ data: { userId: USER, repoOwner: 'octo', repoName: 'old', repoFullName: 'octo/old', status: 'COMPLETED', createdAt: new Date(Date.now() - 60_000) } });
      const latest = await prisma.importJob.create({ data: { userId: USER, repoOwner: 'octo', repoName: 'new', repoFullName: 'octo/new', status: 'PROCESSING' } });

      expect(await service.getLatestJob(USER)).toMatchObject({ jobId: latest.id, repoFullName: 'octo/new' });
      expect(await service.getLatestJob(OTHER_USER)).toBeNull();
    });
  });

  describe('after a restart', () => {
    it('fails the jobs nothing is running any more', async () => {
      const interrupted = await prisma.importJob.create({
        data: { userId: USER, repoOwner: 'octo', repoName: 'app', repoFullName: 'octo/app', status: 'PROCESSING', stage: 'ANALYZING' },
      });
      const finished = await prisma.importJob.create({ data: { userId: USER, repoOwner: 'octo', repoName: 'old', repoFullName: 'octo/old', status: 'COMPLETED' } });

      await service.onApplicationBootstrap();

      expect(prisma.importJob.rows.find((row) => row.id === interrupted.id)).toMatchObject({
        status: ImportJobStatus.FAILED,
        error: expect.stringMatching(/restarted while this import was running/) as unknown as string,
      });
      expect(prisma.importJob.rows.find((row) => row.id === finished.id)?.status).toBe(ImportJobStatus.COMPLETED);
    });
  });

  describe('repository listing', () => {
    it('asks GitHub for the caller’s own repositories', async () => {
      const urls: string[] = [];
      global.fetch = jest.fn(async (input: string) => {
        urls.push(input);
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => [
            { owner: { login: 'octo' }, name: 'app', full_name: 'octo/app', private: true, default_branch: 'main', description: null, updated_at: '2026-09-01T00:00:00Z', language: 'TypeScript' },
          ],
        };
      }) as never;

      const repos = await service.listRepos(USER);

      expect(repos).toEqual([
        {
          owner: 'octo',
          name: 'app',
          fullName: 'octo/app',
          description: null,
          private: true,
          defaultBranch: 'main',
          updatedAt: '2026-09-01T00:00:00Z',
          language: 'TypeScript',
        },
      ]);
      expect(urls[0]).toContain('/user/repos?per_page=100');
    });

    it('tells the user to reconnect when GitHub says the token is spent', async () => {
      global.fetch = jest.fn(async () => ({
        ok: false,
        status: 401,
        headers: { get: () => null },
        json: async () => ({}),
        text: async () => 'Bad credentials',
      })) as never;

      await expectApiError(service.listRepos(USER), 400, ErrorCode.GITHUB_TOKEN_EXPIRED);
    });
  });
});
