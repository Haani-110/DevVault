/**
 * Unit tests: fast, no database, no network. Each spec fakes the collaborators
 * it needs (Prisma via `test/fake-prisma.ts`, `fetch` via `jest.fn()`), so
 * `npm test` passes on a laptop with no Postgres running — the same fake backs
 * the e2e specs, which is why it lives in `test/` rather than `src/`.
 *
 * @type {import('jest').Config}
 */
module.exports = {
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  moduleFileExtensions: ['js', 'json', 'ts'],
  // See test/bcrypt-double.ts: the native addon is replaced by a pure-JS
  // implementation of the same algorithm so the suite runs anywhere `npm test`
  // does — no compiler, no binary download.
  moduleNameMapper: { '^bcrypt$': '<rootDir>/test/bcrypt-double.ts' },
  testEnvironment: 'node',
  testRegex: '\\.spec\\.ts$',
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  clearMocks: true,
  restoreMocks: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.module.ts', '!src/main.ts', '!src/server.ts'],
};
