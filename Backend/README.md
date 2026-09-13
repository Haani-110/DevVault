# DevVault — Backend

NestJS 11 + Prisma + PostgreSQL API powering DevVault. It runs entirely on your
machine (`docker compose up -d` for Postgres, then `npm run start:dev`) — the
Railway/Vercel config in this repo is there for when you want to host it, not a
prerequisite for using it.

## Concept

The backend is a fairly standard modular NestJS app: one module per domain
(`auth`, `notes`, `snippets`, `projects`, `tasks`, `dashboard`, `users`,
`email`), each with its own controller, service, and DTOs, all sharing one
Prisma-backed Postgres database. Everything behind `/api/v1/*` except
auth/register/login/OAuth requires a valid JWT access token.

### Auth model

- Email/password accounts store a bcrypt `passwordHash` on `User`.
- OAuth accounts (Google, GitHub) are stored separately in `OAuthAccount`,
  linked to a `User` by `(provider, providerUid)`. A `User` can have a
  password, one or more linked OAuth accounts, or both — sign-in resolves to
  the same `User` row either way by matching email.
- Both login paths issue the same pair of tokens: a short-lived **access
  token** (15 min default) and a longer-lived **refresh token** (7 days
  default), signed with separate secrets (`JWT_ACCESS_SECRET` /
  `JWT_REFRESH_SECRET`). The frontend's Axios interceptor automatically
  calls `/auth/refresh` on a 401 and retries the original request.
- **Forgot password** generates a random token stored in `PasswordReset`
  (1 hour expiry, single-use), emails a link via SendGrid
  (`EmailService`), and always returns the same generic success message
  regardless of whether the email exists — this prevents attackers from
  using the endpoint to discover which emails are registered.

### Data model (Prisma)

```
User ──< Note
     ──< Snippet
     ──< Project ──< Task
     ──< PasswordReset
     ──< OAuthAccount        (provider, providerUid, encrypted access token)
     ──< ImportJob ──1 Project

Project ──< Note      (optional — set when a Note came from an AI import)
        ──< Snippet   (optional — same)
```

`ImportJob` is the record the UI polls: it holds the stage/counter fields, the
`projectId` it fills in on success, and any `warning`/`error`. It goes away with
the user (`onDelete: Cascade`), while its `project` link is `SetNull` — deleting
the imported project leaves the job's history readable, and the notes inside it
belong to the user, not to the import.

`Note` and `Snippet` are otherwise standalone (a user can create either one
without a project) — the `projectId` link exists specifically to support
grouping AI-imported notes/snippets under the project they were imported
into, while regular manually-created notes/snippets stay unattached.

### Why some things return the same response regardless of input

A few endpoints (forgot-password being the main one) intentionally return
identical responses whether or not the underlying condition succeeded, to
avoid leaking information (e.g. "does this email have an account"). If
you're debugging one of these and it "always looks like it worked," check
the **server logs**, not the API response — the response is deliberately
uninformative by design.

## Modules

| Module | Responsibility |
|---|---|
| `auth` | Register/login/refresh, password reset, Google/GitHub OAuth (Passport strategies), JWT issuing & guarding |
| `users` | Profile read/update, account deletion |
| `notes` | CRUD for notes: tags, pin, favorite, archive |
| `snippets` | CRUD for snippets: language, tags, favorite |
| `projects` | CRUD for projects |
| `tasks` | CRUD for tasks within a project (the Kanban board data) |
| `dashboard` | Aggregated stats for the current user (counts, recent activity) |
| `email` | SendGrid wrapper — currently only used for password-reset emails |
| `ai` | Wraps the Groq chat-completions API to turn source files into structured notes/snippets, with batching, retries and a deadline |
| `import` | Uses a user's stored GitHub OAuth token to list/read repos and feed them through `ai` into notes, snippets and a new project, as a resumable background job |
| `health` | `GET /health` for the frontend's connection indicator — probes the database with a deadline so "API up, database gone" is distinguishable |
| `common` | The cross-cutting bits: error codes, the exception filter that shapes every error body, `ParseIdPipe`, the transform interceptor, rate-limit presets |

## Local setup

```bash
# Any Postgres will do, e.g. Postgres 16 on :5432 for `DATABASE_URL` below:
#   docker run -d --name devvault-pg -e POSTGRES_PASSWORD=devvault \
#     -e POSTGRES_DB=devvault -p 5432:5432 postgres:16
npm install
cp .env.example .env             # then fill in the values below
npx prisma migrate deploy        # applies prisma/migrations (schema.prisma is the source of truth)
npm run start:dev                # http://localhost:4000, Swagger at /api/docs
```

`prisma/migrations` is checked in, so use `npx prisma migrate dev --name <what_changed>`
after editing `schema.prisma` and commit both files together. `db push` still
works for a throwaway database but leaves the migration history behind.

Nothing in the app's test suite needs Postgres — see **Tests** below.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | ✅ in prod | Signs access tokens — generate a long random string, don't reuse the refresh secret |
| `JWT_REFRESH_SECRET` | ✅ in prod | Signs refresh tokens — must differ from the access secret |
| `JWT_ACCESS_EXPIRES_IN` | — (default `15m`) | Access token lifetime |
| `JWT_REFRESH_EXPIRES_IN` | — (default `7d`) | Refresh token lifetime |
| `PORT` | — (default `4000`) | Server port |
| `FRONTEND_URL` | ✅ in prod | Used to build password-reset links and OAuth redirect targets, and allowed as a CORS origin. Comma-separated for more than one |
| `CORS_ALLOWED_ORIGINS` | — | Extra browser origins allowed to call the API, on top of `FRONTEND_URL` |
| `OAUTH_ENCRYPTION_KEY` | — | 32 bytes of hex. Encrypts the GitHub/Google tokens at rest (`v1:<iv>:<tag>:<ciphertext>`). Unset stores them in plaintext, which is fine only for a throwaway local database |
| `SENDGRID_API_KEY` | — for real emails | Without this, password-reset links are logged to the console instead of emailed — which is all local dev needs |
| `FROM_EMAIL` | — (default `noreply@devvault.local`) | Must be a **verified sender** in SendGrid, or sends are rejected |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | — for Google login | From Google Cloud Console → APIs & Services → Credentials |
| `GOOGLE_CALLBACK_URL` | — for Google login | Must exactly match an Authorized redirect URI registered in Google Cloud Console |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | — for GitHub login | From github.com/settings/developers |
| `GITHUB_CALLBACK_URL` | — for GitHub login | Must exactly match the callback URL registered on the GitHub OAuth App |
| `GITHUB_SCOPE` | — (default `user:email repo`) | OAuth scopes requested at link time. Drop to `user:email public_repo` if the importer should only see public repos |
| `GROQ_API_KEY` | — for AI import | Powers the `ai` module (Groq, `llama-3.3-70b-versatile`). Without it the import routes answer 500 with code `AI_NOT_CONFIGURED` and the rest of the app keeps working |
| `GROQ_MODEL` | — (default `llama-3.3-70b-versatile`) | Chat model used for summarising files |
| `THROTTLE_TTL_MS` / `THROTTLE_LIMIT` | — (default `60000` / `100`) | Global rate-limit backstop. The credential routes are stricter in code |
| `IMPORT_TIMEOUT_MS` | — (default `600000`) | Wall-clock ceiling for one import job before it is failed with a warning |

Every one of these is read in exactly one place, `src/config/env.ts`, which also
holds the defaults and refuses to boot in production on the development JWT
secrets. `.env.example` documents each one where you'll be typing it.

> **Note on GitHub OAuth scope:** the GitHub strategy requests the `repo`
> scope (not just `user:email`), because the AI import feature needs to read
> a user's repository contents using the same token issued at login. If a
> user connected GitHub before this scope was added, they'll need to
> disconnect and reconnect (or just log in again via GitHub) to get a token
> with the wider scope.

## Response shapes

Errors are shaped in exactly one place, `src/common/filters/http-exception.filter.ts`,
so the frontend can render a failure without guessing what a 400 looks like on
this API. Successful responses are the decorated DTO objects, unchanged:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_FAILED",
  "message": "title should not be empty",
  "details": ["title should not be empty", "tags must contain no more than 20 elements"],
  "path": "/api/v1/notes",
  "timestamp": "2026-09-13T00:00:00.000Z"
}
```

`details` appears only when `ValidationPipe` reports more than one problem: it
returns one message per failing field, and the filter keeps the list while
putting a single displayable string in `message`.

`code` comes from `src/common/errors/error-codes.ts` and is stable — the UI keys
its behaviour off it (`GITHUB_NOT_CONNECTED`, `IMPORT_ALREADY_RUNNING`,
`AI_NOT_CONFIGURED`, …) rather than off the human-readable message. Unknown
routes get `NOT_FOUND_GENERIC`, and an unmatched path still carries the same
envelope because the filter is registered globally.

## Health

`GET /api/v1/health` answers `200 { status: "ok", database: "up", uptimeSeconds, timestamp }`,
or `503 { status: "degraded", database: "down", … }` when the `SELECT 1` probe
fails or exceeds its deadline. The probe has a deadline on purpose: without one,
a dead database hangs the request and the UI keeps claiming everything is fine.
The driver's error text never reaches the client. This is what
`Frontend/src/hooks/useBackendStatus.ts` polls to power the "Server reachable"
indicator on the sign-in pages.

## AI-assisted GitHub import

All four routes sit under `/api/v1/import/github` and require a bearer token:

| Route | Behaviour |
|---|---|
| `GET /repos` | The user's own and contributed repositories (`owner`, `name`, `fullName`, `description`, `private`, `defaultBranch`, `updatedAt`, `language`), read from `api.github.com` with their stored token |
| `POST /` | Body `{ owner, repo, branch? }` → `202 { jobId }`. The repository is validated synchronously, so a typo answers `400 REPOSITORY_NOT_FOUND` instead of failing a second later inside a job row |
| `GET /jobs/:jobId` | `stage`, `stageLabel`, `progress`, `totalFiles`/`processedFiles`, `currentFile`, `totalBatches`/`completedBatches`, then `result`, `warning`, `error`. Owner-scoped: anyone else's job id is `404 IMPORT_JOB_NOT_FOUND` |
| `GET /jobs/latest` | `{ job }` or `{ job: null }` — how the modal resumes an import after a reload |

Flow: decrypt the user's GitHub token → `GET /repos/:owner/:repo` (a 404 there is
`REPOSITORY_NOT_FOUND`, raised before anything is written) → recursive tree →
filter to source-like files, skipping binaries, lockfiles and build output,
capped at 60 files and 8 KB each → batches go to Groq, which must answer with a
JSON array of note/snippet/task objects → `saveAnalysis` creates the `Project`
and writes every row with provenance (`sourcePath`, `generatedByAI`,
`filesAnalyzed`) attached.

Deliberate limits, all of which surface as `ImportJob.warning` rather than a
silent loss: files that fail to download, batches that fail (the job continues;
if **every** batch fails it is `AI_FAILED`), and the wall-clock ceiling in
`IMPORT_TIMEOUT_MS`. Progress writes are coalesced, so a fast job doesn't spam
the database. Jobs left `PROCESSING` by a restart are marked `FAILED` at boot
with an explanatory warning, because nothing would ever finish them.

## Tests

```bash
npm run test       # 99 unit tests (services, pipes, filters, crypto, the AI client)
npm run test:e2e   # 27 end-to-end tests against a real Nest app + HTTP stack
npm run test:all   # both
```

Both suites run against `test/fake-prisma.ts`, an in-memory double that
implements the slice of Prisma this app uses with real `where`/`select`/`orderBy`
filtering — so an endpoint that forgets to scope a query by `userId` fails here
the same way it would leak data in production. No database, network, GitHub
token or Groq key is required: `test/setup-env.ts` pins the environment and the
specs stub `fetch`.

The e2e specs drive the app through `call()` in `test/app.e2e-spec.ts`, which
asserts on the parsed JSON body (`expect(status, body)` deep-equals, so partial
matches have to go through the helper). They lock in the guarantees that matter:
identical bodies for "no such user" and "wrong password", no `passwordHash` or
`passwordChangedAt` in any profile response, single-use reset tokens, a foreign
note indistinguishable from a missing one, and 429s switched off for tests only
(`skipIf: () => isTest`) so the production limits stay as they are.

## Hosting (optional)


- Nothing in this repository is deployed for you. The app is complete and runs
  locally; `nixpacks.toml` / `railway.toml` / `vercel.json` are there so hosting
  it is a configuration step rather than a code change, and they are the only
  deployment files this project claims to have tested by inspection.
- If you do use Railway, it builds via `nixpacks.toml` (`npm install` → `npm run
  build` → `npm run start:prod`), or via `railway.toml` at the repo root when
  deploying the whole monorepo. `postinstall` runs `prisma generate`; add
  `npx prisma migrate deploy` to the release command so schema changes land.
- All environment variables above must be set in Railway's **Variables**
  tab — Railway does not read `.env` files from your repo.
- After adding/editing variables, Railway typically auto-redeploys; if not,
  trigger a manual redeploy so the running instance picks up the change.
- Check the **logs** after testing any auth/email/AI flow —
  several of these endpoints intentionally give little away in their HTTP
  response (see "Why some things return the same response" above), so the
  logs are the actual source of truth when something isn't working.
- `FRONTEND_URL` must be the real deployed origin: it is where OAuth and
  password-reset links redirect to, and an `http://localhost:5000` there means
  a deployed login flow bounces the user back to their own machine.

## API docs

Swagger UI is auto-generated from decorators and available at `/api/docs`
(e.g. `http://localhost:4000/api/docs` locally, or
`<your-railway-url>/api/docs` in production).
