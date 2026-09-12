import { observableFailure } from '../../test/helpers';
import { AiService } from './ai.service';
import { ErrorCode } from '../common/errors/error-codes';

const FILES = [
  { path: 'src/auth/login.ts', content: 'export function login() {}' },
  { path: 'src/api/client.ts', content: 'export const api = 1;' },
];

/**
 * The smallest shape that behaves like the part of `fetch` this service uses.
 * `content` is a string because that is what the completions API returns:
 * `message.content` is the model's raw text, which this service then parses.
 */
function jsonResponse(content: string, init: { status?: number; headers?: Record<string, string> } = {}) {
  const status = init.status ?? 200;

  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => init.headers?.[name.toLowerCase()] ?? null },
    json: async () => ({ choices: [{ message: { content } }] }),
    text: async () => content,
  } as unknown as Response;
}

/** A successful response carrying `value` as the model's JSON output. */
const okWith = (value: unknown) => jsonResponse(typeof value === 'string' ? value : JSON.stringify(value));

const analysis = (overrides: Record<string, unknown> = {}) => ({
  notes: [{ title: 'Login', content: 'Handles sign-in.', tags: ['Auth'], sourcePath: 'src/auth/login.ts' }],
  snippets: [{ title: 'Client', code: 'export const api = 1;', language: 'TypeScript', tags: [], sourcePath: 'src/api/client.ts' }],
  tasks: [{ title: 'Add rate limiting', status: 'BACKLOG', priority: 'HIGH', sourcePath: 'src/auth/login.ts' }],
  ...overrides,
});

describe('AiService', () => {
  let service: AiService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    service = new AiService();
    fetchMock = jest.fn().mockRejectedValue(new Error('unexpected fetch — the service retried further than this test allows'));
    global.fetch = fetchMock as never;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /** Runs every scheduled backoff/pacing timer, so the work can settle. */
  const settle = () => jest.advanceTimersByTimeAsync(180_000);

  /**
   * A promise that never rejects, so a failure that a spec is *about* to assert
   * on is not first reported to Jest as an unhandled rejection. (Fake timers put
   * the rejection and the assertion in different microtask turns, which is
   * exactly the gap Jest's detector looks at.)
   */
  const track = <T,>(promise: Promise<T>) =>
    promise.then(
      (value) => ({ value: value as T | undefined, error: undefined as Error | undefined }),
      (error: Error) => ({ value: undefined as T | undefined, error }),
    );

  /** One successful request, one parsed result — the shape most specs need. */
  async function analyze(value: unknown) {
    fetchMock.mockResolvedValue(okWith(value));
    const settled = track(service.analyzeRepoFiles('owner/repo', FILES));
    await settle();
    const { value: result, error } = await settled;
    if (error) throw error;
    return result!;
  }

  /** Runs the analysis against whatever `fetchMock` is set to, failures included. */
  async function attempt() {
    const settled = track(service.analyzeRepoFiles('owner/repo', FILES));
    await settle();
    return settled;
  }

  it('is configured when a key is present', () => {
    expect(service.isConfigured).toBe(true);
  });

  it('tells the operator what to set when no key is configured', async () => {
    const saved = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;

    try {
      let unconfigured: AiService | undefined;
      jest.isolateModules(() => {
        unconfigured = new (require('./ai.service').AiService)();
      });

      expect(unconfigured!.isConfigured).toBe(false);
      const error = await unconfigured!.analyzeRepoFiles('owner/repo', FILES).catch((e: Error) => e);
      expect(observableFailure(error)).toMatchObject({
        statusCode: 500,
        code: ErrorCode.AI_NOT_CONFIGURED,
        message: expect.stringContaining('GROQ_API_KEY') as unknown as string,
      });
    } finally {
      process.env.GROQ_API_KEY = saved;
    }
  });

  it('sends one request per batch and returns the analysis', async () => {
    const result = await analyze(analysis());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.notes[0].title).toBe('Login');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer gsk_test_key_do_not_use');
    expect(init.body).toContain('src/auth/login.ts');
    expect(init.signal).toBeDefined();
  });

  it('asks the model to cite only files it was actually shown', async () => {
    await analyze(analysis());

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.messages[0].content).toContain('src/auth/login.ts');
    expect(body.messages[1].content).toContain('--- FILE: src/api/client.ts ---');
  });

  describe('output handling', () => {
    it('accepts JSON wrapped in a code fence, because models do that', async () => {
      await expect(analyze('```json\n' + JSON.stringify(analysis()) + '\n```')).resolves.toMatchObject({
        notes: [{ title: 'Login' }],
      });
    });

    it('drops items the database could not store and keeps the rest', async () => {
      const result = await analyze({
        notes: [
          ...(analysis().notes as object[]),
          { title: '   ', content: 'no title, so no note' },
          { content: 'no title at all' },
        ],
        snippets: [{ title: 'No code', code: '' }],
      });

      expect(result.notes).toHaveLength(1);
      expect(result.snippets).toEqual([]);
    });

    it('sanitizes the language into the form the snippet DTO accepts', async () => {
      const result = await analyze(analysis({ snippets: [{ title: 'S', code: 'x', language: 'TypeScript (React)' }] }));

      expect(result.snippets[0].language).toBe('typescriptreact');
    });

    it('normalizes tags: lowercased, trimmed, capped at 20', async () => {
      const result = await analyze(
        analysis({
          notes: [{ title: 'N', content: 'c', tags: ['  React  ', '', ...Array.from({ length: 30 }, (_v, i) => `tag${i}`)] }],
        }),
      );

      expect(result.notes[0].tags[0]).toBe('react');
      expect(result.notes[0].tags).toHaveLength(20);
    });

    it('ignores a sourcePath for a file it was never shown', async () => {
      const result = await analyze(analysis({ notes: [{ title: 'N', content: 'c', sourcePath: '../../etc/passwd' }] }));

      expect(result.notes[0].sourcePath).toBeUndefined();
    });

    it('substitutes safe defaults for enum values outside the schema', async () => {
      const result = await analyze(analysis({ tasks: [{ title: 'T', status: 'WONTFIX', priority: 'ASAP' }] }));

      expect(result.tasks[0]).toMatchObject({ status: 'BACKLOG', priority: 'MEDIUM' });
    });
  });

  describe('failure handling', () => {
    it('retries a 429 and waits for the Retry-After it was given', async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: { get: (name: string) => (name === 'retry-after' ? '20' : null) },
          json: async () => ({}),
          text: async () => 'rate limit exceeded',
        } as unknown as Response)
        .mockResolvedValueOnce(okWith(analysis()));

      const settled = track(service.analyzeRepoFiles('owner/repo', FILES));

      await jest.advanceTimersByTimeAsync(19_000);
      expect(fetchMock).toHaveBeenCalledTimes(1); // still waiting out the 20s it asked for
      await settle();
      await settled;

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does not retry a 400, and does not pass the upstream body to the caller', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse('invalid_request_error: model llama-3.3-70b-versatile rejected response_format', { status: 400 }),
      );

      const { error } = await attempt();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(observableFailure(error)).toMatchObject({ statusCode: 502, code: ErrorCode.AI_FAILED });
      expect(error?.message).not.toMatch(/invalid_request_error|llama|response_format/);
    });

    it('retries a 5xx up to three times, then gives up', async () => {
      fetchMock.mockResolvedValue(jsonResponse('upstream exploded', { status: 500 }));

      const { error } = await attempt();

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(observableFailure(error)).toMatchObject({ statusCode: 502, code: ErrorCode.AI_FAILED });
      expect(error?.message).not.toContain('exploded');
    });

    it('treats a network failure as retryable', async () => {
      fetchMock.mockRejectedValue(new Error('fetch failed: ECONNRESET'));

      const { error } = await attempt();

      expect(error?.message).toMatch(/AI service/);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('re-rolls when the response is not JSON instead of failing the batch', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse('this is not json at all')).mockResolvedValue(okWith(analysis()));

      const { value } = await attempt();

      expect(value).toMatchObject({ notes: [{ title: 'Login' }] });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('reports a response with no content as a failure, not a crash', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ choices: [] }),
      } as unknown as Response);

      const { error } = await attempt();

      expect(error).toMatchObject({ code: ErrorCode.AI_FAILED });
    });
  });
});
