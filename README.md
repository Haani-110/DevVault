# DevVault

**DevVault** is a developer productivity platform — one dashboard for the
notes, code snippets, and project/task tracking a developer normally scatters
across five different tools. It started as a Replit prototype and has since
been split into a real, independently deployable frontend and backend.

Everything here runs on your machine: a Postgres database, the NestJS API on
`:4000`, the Vite dev server on `:5000`. No account, no paid service and no
deployed instance is required to use it — the Vercel/Railway configs are
included so hosting is a config change, not a code change. Nothing in this
repository claims to be live anywhere but `localhost`.

## Concept

The core idea is a single "vault" a developer logs into every day that holds:

- **Notes** — markdown notes with tags, pinning, favorites, and archiving.
- **Snippets** — reusable code snippets with language tagging, search, and favorites.
- **Projects & Tasks** — lightweight project containers with a Kanban board
  (Backlog → In Progress → In Review → Done) per project.
- **Dashboard** — an at-a-glance summary of the above (counts, recent activity).
- **Auth** — email/password with secure password reset via email, plus
  "Sign in with Google" and "Sign in with GitHub" as one-click alternatives.

Two more are specced but deliberately not built:
- **API Collections** (a lightweight Postman-style request organizer)
- **Password Vault** (encrypted credential storage)

`Frontend/src/pages/collections/CollectionsPage.tsx` lays out the intended
feature set as a static page so the information architecture is visible, and the
sidebar marks it "soon" with an inert link. Password Vault has no page yet, and
neither has an endpoint.

### AI-assisted GitHub import (built)

A user picks one of their GitHub repositories — using the OAuth connection they
already have, no GitHub App and no separate auth flow — and DevVault reads the
source files and asks a model (Groq, `llama-3.3-70b-versatile` by default) to
turn them into:

- **Notes** summarizing what each module or file does, in plain English
- **Snippets** for the genuinely reusable pieces of code
- **Tasks** seeded onto the new project's board

Everything lands on a `Project` created for that import, with provenance on each
row (`sourcePath`, `filesAnalyzed`, `generatedByAI`), so an imported note can
always be traced back to the file it came from.

It is a **background job, not a long HTTP request**: `POST /api/v1/import/github`
validates the repository and answers `202 { jobId }` immediately, then the UI
polls `GET /import/github/jobs/:jobId` for stage, counters and warnings. That is
what lets the import survive a reload (the modal picks up `jobs/latest` on
mount), and it is why the progress panel can honestly say "3 of 5 analysis
batches failed" instead of showing a green tick over a partial import. Skipping
binaries, capping files at 8 KB, pacing to the free tier's rate limit, and a
10-minute deadline are all in `Backend/src/import/`.

## Project structure

```
/
├── Frontend/   React 19 + Vite + TypeScript — see Frontend/README.md
├── Backend/    NestJS 11 + Prisma + PostgreSQL — see Backend/README.md
└── package.json  (root convenience scripts)
```

## Why two deployments (Railway + Vercel)

The usual shape for this app is: backend (NestJS + Prisma + Postgres) on
**Railway**, frontend (static Vite build) on **Vercel**. They are two
independent services that talk to each other over HTTPS — no shared server, and
no proxying in production. That split is a hosting choice, not a requirement:
running both locally works because Vite proxies `/api`. It does mean:

- The frontend must know the backend's public URL via `VITE_API_BASE_URL`
  (baked in at build time by Vite — see `Frontend/README.md`).
- The backend must know the frontend's public URL via `FRONTEND_URL`, since
  it's used to build password-reset links and OAuth redirect targets.
- CORS, OAuth callback URLs, and cookie/token behavior all have to account
  for the two living on different domains — see the CORS and OAuth notes in
  `Backend/README.md` if you're debugging cross-origin issues.

In local development, this split doesn't matter as much — the Vite dev
server proxies `/api/*` straight to `localhost:4000`, so both apps behave as
if they share an origin. The two-domain reality only shows up once deployed,
which is a common source of confusion (hardcoded relative URLs work locally
and 404 in production, for example) — worth remembering if something works
on `localhost` but not on the live site.

## Local setup

### 1. Install dependencies (both folders at once)

```bash
npm run setup
```

This installs Frontend and Backend dependencies. The Backend `postinstall`
script runs `prisma generate` automatically.

### 2. Create the Backend environment file

Never commit `.env` (it is git-ignored). `Backend/README.md` has the full table
of every variable, including SendGrid, OAuth and Groq keys:
```bash
cp Backend/.env.example Backend/.env
```

`.env.example` is annotated and complete; the three values worth changing for a
real login flow are `DATABASE_URL`, the two JWT secrets (generate each with
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) and
`OAUTH_ENCRYPTION_KEY`, which is what keeps a stored GitHub token encrypted at
rest. `FRONTEND_URL` defaults to `http://localhost:5000`, the Vite port below.

### 3. Create the Frontend environment file

Create `Frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:4000
```

### 4. Create the database tables

```bash
cd Backend && npx prisma migrate deploy
```

### 5. Run the app

Open two terminals:

**Terminal 1 — Backend (port 4000):**
```bash
npm run dev:backend
```

**Terminal 2 — Frontend (port 5000):**
```bash
npm run dev:frontend
```

Open the printed local URL (`http://localhost:5000`) in your browser. In dev the
frontend proxies all `/api` requests to the backend automatically, so no
`VITE_API_BASE_URL` is needed locally — but a production build always needs it,
because a static host has no proxy.

### 6. Tests

```bash
npm run test:backend     # 99 unit + 27 e2e, no database or network needed
npm run test:frontend    # vitest: the refresh interceptor and the routing shell
npm run build            # both apps, type-checked
```

or from inside each folder (`npm run test:all`, `npm test`, `npm run lint`).

The backend suites run against an in-memory Prisma double
(`Backend/test/fake-prisma.ts`), so `docker`-less CI and a laptop with no
Postgres running both get an honest pass/fail.

## API docs

Swagger UI is served by the app itself at `http://localhost:4000/api/docs`
whenever the backend is running — it is generated from the controller
decorators, so it cannot drift from the routes.

## Deployment notes (if you choose to host it)

- **Railway**: builds from `Backend/` via `nixpacks.toml` /
  `railway.toml`. All secrets (DB URL, JWT secrets, SendGrid key, OAuth
  client IDs/secrets, `OAUTH_ENCRYPTION_KEY`, Groq key, `FRONTEND_URL`) must be
  set in Railway's **Variables** tab — Railway does not read `Backend/.env`.
  `postinstall` runs `prisma generate`; add `npx prisma migrate deploy` to the
  release command so schema changes actually apply.
- **Vercel**: builds from `Frontend/`, with **Root Directory** set to
  `Frontend` in the project settings. `VITE_API_BASE_URL` must be set in
  Vercel's **Environment Variables** for **Production and Preview** both —
  Vite bakes this in at build time, so changing it always requires a
  redeploy. A `Frontend/vercel.json` rewrite rule is required so that
  client-side routes (React Router) don't 404 on direct navigation/refresh.
- After changing any environment variable on either platform, trigger a
  redeploy — neither platform hot-reloads env vars into an already-running
  build.
