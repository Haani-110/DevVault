import { describe, expect, it } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import type { AxiosResponse } from 'axios';
import { apiErrorMessage, toApiError } from '@/lib/api-error';

/** Builds the same error axios hands to an interceptor for a non-2xx answer. */
function httpError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() };
  const response = {
    data,
    status,
    statusText: '',
    headers: {},
    config,
  } as unknown as AxiosResponse;
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config as never, {}, response);
}

const networkError = () => new AxiosError('Network Error', 'ERR_NETWORK', {} as never, {} as never, undefined);

describe('toApiError', () => {
  it('reads the backend envelope', () => {
    const error = toApiError(
      httpError(
        409,
        {
          statusCode: 409,
          code: 'IMPORT_ALREADY_RUNNING',
          message: 'An import is already running for this account.',
          path: '/api/v1/import/github',
          timestamp: '2026-09-13T00:00:00.000Z',
        },
      ),
    );

    expect(error).toMatchObject({
      status: 409,
      code: 'IMPORT_ALREADY_RUNNING',
      message: 'An import is already running for this account.',
      offline: false,
    });
  });

  it('keys validation details by field, first message winning', () => {
    const error = toApiError(
      httpError(400, {
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'title should not be empty',
        details: [
          'title should not be empty',
          'tags must contain no more than 20 elements',
          'title must be shorter than 200 characters',
        ],
      }),
    );

    expect(error.message).toBe('title should not be empty');
    expect(error.fields).toEqual({
      title: 'title should not be empty',
      tags: 'tags must contain no more than 20 elements',
    });
  });

  it('uses the first message when the body sends an array', () => {
    const error = toApiError(httpError(400, { statusCode: 400, message: ['email must be an email'] }));
    expect(error.message).toBe('email must be an email');
  });

  it('marks an unanswered request as offline, because the fix is different', () => {
    const error = toApiError(networkError());

    expect(error.offline).toBe(true);
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.status).toBe(0);
    expect(error.message).toMatch(/cannot reach the server/i);
  });

  it('falls back to the HTTP status when something else answered', () => {
    // An nginx/Caddy error page has no JSON body: the code is gone, but the
    // status still tells the UI the request was answered.
    const error = toApiError(new AxiosError('Bad gateway', 'ERR_BAD_RESPONSE', {} as never, {} as never, {
      data: '<html>502</html>',
      status: 502,
      statusText: 'Bad Gateway',
      headers: {},
    } as never));

    expect(error.status).toBe(502);
    expect(error.code).toBeNull();
    expect(error.offline).toBe(false);
    expect(error.message).toBe('Bad Gateway');
  });

  it('passes through a real Error and uses the caller fallback otherwise', () => {
    expect(toApiError(new Error('Manual upload failed')).message).toBe('Manual upload failed');
    expect(toApiError('nope').message).toBe('Something went wrong. Please try again.');
    expect(toApiError('nope', 'Could not load your repositories.').message).toBe(
      'Could not load your repositories.',
    );
  });
});

describe('apiErrorMessage', () => {
  it('is the one-line form for a toast', () => {
    expect(apiErrorMessage(httpError(404, { code: 'NOTE_NOT_FOUND', message: 'Note not found' }))).toBe(
      'Note not found',
    );
    expect(apiErrorMessage(undefined, 'Could not save that note.')).toBe('Could not save that note.');
  });
});
