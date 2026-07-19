# DevVault — Frontend

React 19 + Vite + TypeScript frontend for DevVault, deployed on Vercel. Talks
to the NestJS backend entirely over HTTP — there is no server-side rendering
and no build-time coupling to the backend beyond the API base URL.

## Stack

React 19 · Vite · TypeScript (strict) · Tailwind CSS · React Router ·
Zustand · TanStack Query · Axios · React Hook Form + Zod · react-icons ·
Recharts · `@monaco-editor/react` (code editing, for Snippets) ·
`@uiw/react-md-editor` (Notes) · react-hot-toast

## Concept

The app is a standard SPA behind client-side routing (`react-router-dom`,
`BrowserRouter`). A few things about how it's wired are worth understanding
before making changes:

### API access is centralized in `lib/axios.ts`

Every request goes through one configured Axios instance:

```ts
const baseURL = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/api/v1`
  : '/api/v1';
```

- In **local dev**, `VITE_API_BASE_URL` is usually left unset, so requests
  go to the relative path `/api/v1/...`, which Vite's dev server proxies to
  `localhost:4000` (see `vite.config.ts`).
- In **production (Vercel)**, there is no proxy — Vercel only serves static
  files. `VITE_API_BASE_URL` must be set to the real backend URL (the
  Railway deployment), or every API call will silently 404 against the
  frontend's own domain instead of reaching the backend.
- This same instance also handles token refresh: a 401 response triggers a
  single in-flight call to `/auth/refresh`, queues any other requests that
  hit 401 while that's happening, then retries them all once a new access
  token comes back.

**Anything that links directly to a backend route outside of this Axios
instance — e.g. the Google/GitHub OAuth buttons, which are plain `<a href>`
tags rather than API calls — needs to build its URL the same way**
(`` `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/v1/auth/google` ``).
A hardcoded relative `href="/api/v1/auth/google"` will work locally (proxy
covers it) and then 404 in production, since Vercel has no `/api/v1/*`
route of its own. This bit the project once already — see `Login.tsx` /
`Register.tsx` for the corrected pattern if you're adding another OAuth-style
external link.

### Client-side routing needs a Vercel rewrite

Because routing is handled entirely by React Router in the browser, a
direct hit to something like `/reset-password?token=...` (e.g. from an email
link) isn't a real file on the server. `Frontend/vercel.json` tells Vercel to
serve `index.html` for any path so React Router can take over:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Without this file, any page that isn't `/` 404s the moment someone
navigates to it directly instead of clicking through the app.

### State

- `store/authStore.ts` (Zustand, persisted) — user, access/refresh tokens,
  `isAuthenticated`.
- `store/themeStore.ts` (Zustand, persisted) — dark/light theme, respects
  `prefers-reduced-motion`.
- Server state (notes, snippets, projects, tasks, dashboard stats) goes
  through TanStack Query via the `services/*Service.ts` layer — each service
  wraps the relevant backend endpoints with typed functions the pages call.

## What's implemented (backed by the real API)

- **Auth** — Login, Register, Forgot/Reset password, Google/GitHub OAuth,
  protected routes, persisted session, automatic token refresh.
- **Dashboard** — stat cards and recent activity pulled from
  `/dashboard/stats`.
- **Notes** — list, search/filter, tags, pin/favorite, archive, markdown
  editor.
- **Snippets** — list, create/edit with Monaco editor, language tagging,
  favorite.
- **Projects** — project grid, create/edit, drill into a project for a
  drag-and-drop Kanban board (Backlog → In Progress → In Review → Done).
- **Settings** — profile form, danger zone (account deletion).
- **Theme** — real dark/light toggle backed by CSS variables.

## What's still a placeholder

**API Collections** and **Password Vault** render informational "coming
soon" screens (see `pages/collections/CollectionsPage.tsx` and
`pages/vault/PasswordVaultPage.tsx`) describing the intended feature set,
but have no backend behind them yet.

## Coming next: AI-assisted GitHub import

A new flow is being built where a user picks one of their GitHub
repositories (using the OAuth connection they already have), and the backend
uses the Claude API to generate a starter set of Notes and Snippets from that
repo's source, grouped under a new Project. On the frontend this will mean:
a repo picker (calling a new `import` service), an import-progress state, and
a redirect into the newly created Project once it's done. Not yet present in
`services/` or `pages/` — this section will be updated once that lands.

## Getting started

```bash
npm install
cp .env.example .env
npm run dev
```

Set `Frontend/.env`:
```env
VITE_API_BASE_URL=http://localhost:4000
```

Open the printed local URL (Vite will show it, typically
`http://localhost:5173` or `:5000` depending on `vite.config.ts`). The dev
server proxies `/api/*` to `http://localhost:4000`, so the backend needs to
be running separately (see `Backend/README.md`).

## Deploying to Vercel

- **Root Directory** must be set to `Frontend` in the Vercel project
  settings (since the repo also contains `Backend/` at the same level).
- Set `VITE_API_BASE_URL` in **Settings → Environment Variables** for both
  **Production and Preview** environments — it's baked in at build time, so
  changing it always requires a redeploy, and Preview deployments won't pick
  up a Production-only value.
- `vercel.json` (see above) must be present for client-side routes to work
  on direct navigation instead of 404ing.
