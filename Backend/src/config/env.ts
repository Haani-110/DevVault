/**
 * Single place where `process.env` is read, so it is obvious which variables
 * the backend actually needs and what happens when one is missing.
 *
 * Rules applied here:
 *  - Secrets are only defaulted in development. With `NODE_ENV=production` a
 *    missing/default JWT secret throws at boot rather than silently running on
 *    a guessable key.
 *  - Everything else falls back to a working local-dev value, because the
 *    intended way to run this project is `npm run start:dev` on a laptop.
 */

/** Secrets shipped in this repo's `.env.example` — never acceptable in production. */
const INSECURE_DEFAULTS = new Set([
  'devvault-access-secret-change-in-production',
  'devvault-refresh-secret-change-in-production',
]);

/** Placeholder that keeps Passport constructible when an OAuth app isn't configured. */
export const OAUTH_NOT_CONFIGURED = 'OAUTH_NOT_CONFIGURED';

function read(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function str(name: string, fallback: string): string {
  return read(name) ?? fallback;
}

/** Positive integer from an env var; anything else keeps the caller's default. */
function positiveInt(name: string, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  const raw = read(name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= max ? parsed : fallback;
}

/** Comma-separated list, trimmed, with trailing slashes removed. */
function list(name: string, fallback: string[] = []): string[] {
  const raw = read(name);
  if (!raw) return fallback;
  return raw
    .split(',')
    .map((v) => v.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

export const isProduction = process.env.NODE_ENV === 'production';

/** Jest sets NODE_ENV=test by default; used to opt the rate limiter out of tests. */
export const isTest = process.env.NODE_ENV === 'test';

function requireInProduction(name: string, current: string): string {
  if (isProduction && INSECURE_DEFAULTS.has(current)) {
    throw new Error(
      `${name} must be set to a unique secret in production (the development default is published in this repository)`,
    );
  }
  return current;
}

/**
 * Where the SPA lives. Used for OAuth/redirect targets and as the allowed CORS
 * origin. A comma-separated list is accepted for the rare case of a preview
 * deployment that needs to talk to the same API.
 */
export const frontendUrls = list('FRONTEND_URL', ['http://localhost:5000']);

/**
 * Origins allowed to call the API, on top of `FRONTEND_URL`. `origin: true`
 * reflects any site back a credentialed CORS response, which is the
 * "works everywhere, secure nowhere" option — so the list is explicit instead.
 */
export const allowedOrigins: string[] = [...frontendUrls, ...list('CORS_ALLOWED_ORIGINS')];

export const env = {
  port: positiveInt('PORT', 4000, 65_535),
  jwt: {
    accessSecret: requireInProduction(
      'JWT_ACCESS_SECRET',
      str('JWT_ACCESS_SECRET', 'devvault-access-secret-change-in-production'),
    ),
    refreshSecret: requireInProduction(
      'JWT_REFRESH_SECRET',
      str('JWT_REFRESH_SECRET', 'devvault-refresh-secret-change-in-production'),
    ),
    accessExpiresIn: str('JWT_ACCESS_EXPIRES_IN', '15m'),
    refreshExpiresIn: str('JWT_REFRESH_EXPIRES_IN', '7d'),
  },
  /**
   * 32-byte hex key used to encrypt provider OAuth tokens at rest. Optional on
   * purpose: without it the app still works (tokens are stored as-is, which is
   * what a throwaway local database expects) and the crypto service logs a
   * single warning telling you to set it.
   */
  oauthEncryptionKey: read('OAUTH_ENCRYPTION_KEY'),
  github: {
    clientId: str('GITHUB_CLIENT_ID', OAUTH_NOT_CONFIGURED),
    clientSecret: str('GITHUB_CLIENT_SECRET', OAUTH_NOT_CONFIGURED),
    callbackUrl: str('GITHUB_CALLBACK_URL', 'http://localhost:4000/api/v1/auth/github/callback'),
    // Space-separated, the way GitHub wants it in an authorize URL. `repo` is
    // what lets the importer read private repositories; set GITHUB_SCOPE to
    // 'user:email public_repo' to restrict it to public ones.
    scope: str('GITHUB_SCOPE', 'user:email repo'),
  },
  google: {
    clientId: str('GOOGLE_CLIENT_ID', OAUTH_NOT_CONFIGURED),
    clientSecret: str('GOOGLE_CLIENT_SECRET', OAUTH_NOT_CONFIGURED),
    callbackUrl: str('GOOGLE_CALLBACK_URL', 'http://localhost:4000/api/v1/auth/google/callback'),
  },
  groq: {
    apiKey: read('GROQ_API_KEY'),
    /** Optional override of the model the AI import asks for by name. */
    model: read('GROQ_MODEL'),
  },
  sendgridApiKey: read('SENDGRID_API_KEY'),
  fromEmail: str('FROM_EMAIL', 'noreply@devvault.local'),
  /** Requests per `windowMs`, per IP, across the whole API. */
  throttle: {
    limit: positiveInt('THROTTLE_LIMIT', 100),
    windowMs: positiveInt('THROTTLE_TTL_MS', 60_000),
  },
  /** Wall-clock ceiling for one background import before it is failed. */
  importTimeoutMs: positiveInt('IMPORT_TIMEOUT_MS', 10 * 60_000),
};

export type Env = typeof env;
