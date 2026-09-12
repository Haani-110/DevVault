/**
 * `bcrypt` (a dependency of the app) is a native addon: installing it needs
 * either a C++ toolchain plus Node headers or a prebuilt binary download. A
 * test run should not depend on either, so Jest maps `bcrypt` to `bcryptjs` —
 * the same algorithm, written in plain JavaScript.
 *
 * Why not a hand-written fake instead: these specs are only worth anything if
 * hashing and comparison are real (salted, cost-factor'd, and genuinely
 * password-dependent). `bcryptjs` gives that without inventing a scheme in test
 * code, and its `$2b$10$` output is byte-compatible with what the app produces.
 *
 * The application itself still uses `bcrypt` — this mapping is test-only, and
 * lives in `jest.config.js` / `test/jest-e2e.config.js`.
 */
// `import * as` (not a default import) to match how the app itself imports
// bcrypt — this project does not enable `esModuleInterop`.
import * as bcrypt from 'bcryptjs';

export const hash = bcrypt.hash;
export const compare = bcrypt.compare;
export const genSalt = bcrypt.genSalt;
export const hashSync = bcrypt.hashSync;
export const compareSync = bcrypt.compareSync;
