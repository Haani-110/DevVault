/**
 * Environment for the test runs, applied before the app modules are imported
 * (Jest `setupFiles`), because `src/config/env.ts` reads `process.env` once at
 * import time.
 *
 * `THROTTLE_LIMIT` is raised so a suite that fires dozens of requests is not
 * accidentally testing the limiter's arithmetic — the routes under test assert
 * on 400/401/404, and a 429 partway through a suite would be a false failure.
 * The secrets are pinned so results don't depend on a developer's local `.env`.
 */
import { Logger } from '@nestjs/common';

process.env.NODE_ENV = 'test';
process.env.THROTTLE_LIMIT = '100000';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
// A fixed 32-byte key so token encryption is *on* under test: the point of
// several specs below is that provider tokens are not stored in plaintext.
process.env.OAUTH_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.FRONTEND_URL = 'http://localhost:5000';
// A placeholder key so the AI-backed code paths are reachable under test. No
// request ever leaves the process: every spec that could call Groq mocks fetch.
process.env.GROQ_API_KEY = 'gsk_test_key_do_not_use';

// Nest's Logger writes to stdout, which buries the actual assertion output in
// the expected warnings these suites deliberately trigger (a mail provider that
// is down, a 429 from Groq, …). Re-run with `TEST_LOGS=1` to see them.
if (process.env.TEST_LOGS !== '1') Logger.overrideLogger([]);
