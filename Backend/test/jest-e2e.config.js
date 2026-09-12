/**
 * End-to-end tests: the real Nest application (routes, guards, ValidationPipe,
 * the error filter) with Prisma replaced by an in-memory double.
 *
 * What that proves: the global URL prefix, DTO validation, which routes require
 * a token, that reads are scoped to the caller, and the exact JSON error shape
 * clients are written against.
 *
 * What it does not prove: SQL, migration behaviour, database cascades and real
 * constraint enforcement — those need a Postgres to point `DATABASE_URL` at, and
 * this suite deliberately runs with no database available.
 *
 * @type {import('jest').Config}
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  // See test/bcrypt-double.ts: the native addon is replaced by a pure-JS
  // implementation of the same algorithm so the suite runs anywhere `npm test`
  // does — no compiler, no binary download.
  moduleNameMapper: { '^bcrypt$': '<rootDir>/test/bcrypt-double.ts' },
  rootDir: '..',
  testEnvironment: 'node',
  testRegex: '\\.e2e-spec\\.ts$',
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
};
