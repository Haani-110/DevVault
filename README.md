# DevVault

**DevVault** is a developer productivity platform — one dashboard for the
notes, code snippets, and project/task tracking a developer normally scatters
across five different tools. It started as a Replit prototype and has since
been split into a real, independently deployable frontend and backend.

Live example deployment:
- Frontend (Vercel): `https://<your-vercel-app>.vercel.app`
- Backend (Railway): `https://<your-railway-app>.up.railway.app`
- API docs (Swagger): `<backend-url>/api/docs`

## Concept

The core idea is a single "vault" a developer logs into every day that holds:

- **Notes** — markdown notes with tags, pinning, favorites, and archiving.
- **Snippets** — reusable code snippets with language tagging, search, and favorites.
- **Projects & Tasks** — lightweight project containers with a Kanban board
  (Backlog → In Progress → In Review → Done) per project.
- **Dashboard** — an at-a-glance summary of the above (counts, recent activity).
- **Auth** — email/password with secure password reset via email, plus
  "Sign in with Google" and "Sign in with GitHub" as one-click alternatives.

Two features are designed but not yet built:
- **API Collections** (a lightweight Postman-style request organizer)
- **Password Vault** (encrypted credential storage)

Both currently render as "coming soon" screens in the frontend so the
information architecture is visible even before the backend exists for them.

### Where this is heading: AI-assisted import

The next major feature in progress is **AI-assisted project import**: a user
connects/imports a GitHub repository, and DevVault reads through the source
files and uses the Claude API to automatically generate:
- **Notes** summarizing what each module/file does, in plain English
- **Snippets** — the genuinely reusable pieces of code worth keeping around

Both get attached to a new `Project` created for that import, so a repo you
drop in becomes a pre-populated DevVault workspace instead of a blank one.
This relies on GitHub OAuth already storing a usable access token per user
(see `OAuthAccount` in the Prisma schema) — no separate GitHub App or extra
auth flow is needed to read a user's own repos.

## Project structure

```
/
├── Frontend/   React 19 + Vite + TypeScript — see Frontend/README.md
├── Backend/    NestJS 11 + Prisma + PostgreSQL — see Backend/README.md
└── package.json  (root convenience scripts)
```

## Why two separate deployments (Railway + Vercel)

The backend (NestJS + Prisma + Postgres) runs on **Railway**, and the frontend
(static Vite build) runs on **Vercel**. They are two independent services that
talk to each other over HTTPS — there is no shared server and no build-time
proxying in production. This means:

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

Create `Backend/.env` (never commit this — see the environment variable
table in `Backend/README.md` for the full list, including SendGrid,
OAuth, and Anthropic keys):

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/devvault"
JWT_ACCESS_SECRET="<generate with: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\">"
JWT_REFRESH_SECRET="<generate the same way — must be different from the access secret>"
FRONTEND_URL="http://localhost:5173"
```

### 3. Create the Frontend environment file

Create `Frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:4000
```

### 4. Create the database tables

```bash
cd Backend && npx prisma db push
```

### 5. Run the app

Open two terminals:

**Terminal 1 — Backend (port 4000):**
```bash
cd Backend && npm run start:dev
```

**Terminal 2 — Frontend (port 5000/5173 depending on config):**
```bash
cd Frontend && npm run dev
```

Open the printed local URL in your browser. In dev, the frontend proxies all
`/api` requests to the backend automatically — no `.env` value is strictly
required for local-only testing, but production always needs it.

## API docs

Swagger UI is available at `http://localhost:4000/api/docs` when the backend
is running locally, or `<your-railway-url>/api/docs` in production.

## Deployment notes (Railway + Vercel)

- **Railway**: builds from `Backend/` via `nixpacks.toml` /
  `railway.toml`. All secrets (DB URL, JWT secrets, SendGrid key, OAuth
  client IDs/secrets, `FRONTEND_URL`, Anthropic key) must be set in Railway's
  **Variables** tab — Railway does not read `Backend/.env`.
- **Vercel**: builds from `Frontend/`, with **Root Directory** set to
  `Frontend` in the project settings. `VITE_API_BASE_URL` must be set in
  Vercel's **Environment Variables** for **Production and Preview** both —
  Vite bakes this in at build time, so changing it always requires a
  redeploy. A `Frontend/vercel.json` rewrite rule is required so that
  client-side routes (React Router) don't 404 on direct navigation/refresh.
- After changing any environment variable on either platform, trigger a
  redeploy — neither platform hot-reloads env vars into an already-running
  build.
