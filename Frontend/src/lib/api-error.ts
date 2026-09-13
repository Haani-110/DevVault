/**
 * One place that turns whatever axios rejected with into something a component
 * can render.
 *
 * The backend answers every handled error with
 * `{ statusCode, code, message, details?, path, timestamp }`, where `code` is
 * the stable identifier (`IMPORT_ALREADY_RUNNING`, `GITHUB_NOT_CONNECTED`, …)
 * and `message` is copy meant for humans. Components should branch on `code`
 * and print `message` — that is the whole reason this file exists rather than
 * each page digging through `(err as any)?.response?.data?.message`.
 */
import { AxiosError } from 'axios';

export interface ApiError {
  /** 0 when nothing answered — the request never got a response at all. */
  status: number;
  /** The backend's stable code, or null for errors that never reached it. */
  code: string | null;
  /** Safe to render as-is. */
  message: string;
  /** Field-level messages from a validation failure, keyed by field name. */
  fields: Record<string, string>;
  /** True when the API could not be reached (backend down, wrong URL, offline). */
  offline: boolean;
}

interface ErrorBody {
  statusCode?: number;
  code?: string;
  message?: string | string[];
  details?: string[] | Record<string, unknown>;
}

const GENERIC = 'Something went wrong. Please try again.';

/** Validation messages arrive as `["email must be an email", …]`. */
function fieldsFrom(details: unknown): Record<string, string> {
  if (!Array.isArray(details)) return {};

  const fields: Record<string, string> = {};
  for (const entry of details) {
    if (typeof entry !== 'string') continue;
    // class-validator phrases every message as `<property> <constraint>`, and a
    // property name never contains a space — so the first token is the key.
    const space = entry.indexOf(' ');
    if (space <= 0) continue;
    const field = entry.slice(0, space);
    if (!fields[field]) fields[field] = entry;
  }
  return fields;
}

export function toApiError(error: unknown, fallback = GENERIC): ApiError {
  if (!(error instanceof AxiosError)) {
    return {
      status: 0,
      code: null,
      message: error instanceof Error && error.message ? error.message : fallback,
      fields: {},
      offline: false,
    };
  }

  if (!error.response) {
    // Timed out, DNS failed, server not running, or CORS blocked the preflight.
    // Worth distinguishing: "check your input" and "start the backend" are
    // different advice, and only one of them is the user's fault.
    return {
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Cannot reach the server. Is the backend running on port 4000?',
      fields: {},
      offline: true,
    };
  }

  const body = (error.response.data ?? {}) as ErrorBody;
  const raw = body.message ?? error.response.statusText ?? fallback;
  const message = Array.isArray(raw) ? (raw[0] ?? fallback) : raw;

  return {
    status: body.statusCode ?? error.response.status,
    code: body.code ?? null,
    message: message || fallback,
    fields: fieldsFrom(body.details),
    offline: false,
  };
}

/** The message to show for a failure, with a caller-supplied context sentence. */
export function apiErrorMessage(error: unknown, fallback = GENERIC): string {
  return toApiError(error, fallback).message;
}
