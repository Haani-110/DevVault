# DevVault — Backend

NestJS 11 + Prisma + PostgreSQL API powering DevVault. Deployed on Railway.

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
     ──< OAuthAccount
Project ──< Note      (optional — set when a Note came from an AI import)
        ──< Snippet   (optional — same)
```

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
| `ai` *(in progress)* | Wraps the Claude API to turn source files into structured notes/snippets |
| `import` *(in progress)* | Uses a user's stored GitHub OAuth token to list/fetch repos and feed them through `ai` into `notes`/`snippets`/a new `project` |

## Local setup

```bash
npm install
cp .env.example .env   # then fill in the values below
npx prisma db push     # creates tables from schema.prisma
npm run start:dev      # http://localhost:4000, Swagger at /api/docs
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | ✅ in prod | Signs access tokens — generate a long random string, don't reuse the refresh secret |
| `JWT_REFRESH_SECRET` | ✅ in prod | Signs refresh tokens — must differ from the access secret |
| `JWT_ACCESS_EXPIRES_IN` | — (default `15m`) | Access token lifetime |
| `JWT_REFRESH_EXPIRES_IN` | — (default `7d`) | Refresh token lifetime |
| `PORT` | — (default `4000`) | Server port |
| `FRONTEND_URL` | ✅ in prod | Used to build password-reset links and OAuth redirect targets. Must be the real deployed frontend URL in production, not `localhost` |
| `SENDGRID_API_KEY` | ✅ for real emails | Without this, password-reset "emails" are only logged to the console — used for local dev fallback |
| `FROM_EMAIL` | — | Must be a **verified sender** in SendGrid, or sends will be rejected |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | ✅ for Google login | From Google Cloud Console → APIs & Services → Credentials |
| `GOOGLE_CALLBACK_URL` | ✅ for Google login | Must exactly match an Authorized redirect URI registered in Google Cloud Console |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | ✅ for GitHub login | From github.com/settings/developers |
| `GITHUB_CALLBACK_URL` | ✅ for GitHub login | Must exactly match the callback URL registered on the GitHub OAuth App |
| `ANTHROPIC_API_KEY` | ✅ for AI import | Powers the `ai` module (Claude API). Without it, AI import endpoints respond with a clear "not configured" error rather than failing silently |

> **Note on GitHub OAuth scope:** the GitHub strategy requests the `repo`
> scope (not just `user:email`), because the AI import feature needs to read
> a user's repository contents using the same token issued at login. If a
> user connected GitHub before this scope was added, they'll need to
> disconnect and reconnect (or just log in again via GitHub) to get a token
> with the wider scope.

## Deploying to Railway

- Railway builds via `nixpacks.toml` (`npm install` → `npm run build` →
  `npm run start:prod`), or via `railway.toml` at the repo root if deploying
  the whole monorepo.
- All environment variables above must be set in Railway's **Variables**
  tab — Railway does not read `.env` files from your repo.
- After adding/editing variables, Railway typically auto-redeploys; if not,
  trigger a manual redeploy so the running instance picks up the change.
- Check **Deployments → Logs** after testing any auth/email/AI flow —
  several of these endpoints intentionally give little away in their HTTP
  response (see "Why some things return the same response" above), so the
  logs are the actual source of truth when something isn't working.

## API docs

Swagger UI is auto-generated from decorators and available at `/api/docs`
(e.g. `http://localhost:4000/api/docs` locally, or
`<your-railway-url>/api/docs` in production).
