# DevVault — Frontend

React 19 + Vite + TypeScript frontend for DevVault. It talks to the NestJS
backend entirely over HTTP — no server-side rendering, and no build-time coupling
to the backend beyond the API base URL. `npm install && npm run dev` is the
whole setup; deploying to a static host is optional (see the last section).

## Stack

React 19 · Vite · TypeScript (strict) · Tailwind CSS · React Router ·
Zustand · TanStack Query · Axios · React Hook Form + Zod · react-icons ·
Recharts · `@monaco-editor/react` (code editing, for Snippets) ·
`@uiw/react-md-editor` (Notes) · react-hot-toast · Vitest + Testing Library

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
- This same instance also handles token refresh: a 401 triggers a single
  in-flight call to `/auth/refresh`, queues any other requests that hit 401
  while that is happening, then retries them all once a new access token comes
  back. Three details are load-bearing (and covered by `src/lib/axios.spec.ts`):
  the refresh request itself is marked so it cannot re-enter this handler —
  otherwise a stale refresh token deadlocks every caller on a promise nothing
  will ever settle; requests that never carried a token (a wrong password) are
  left alone; and when the refresh fails, the queued requests are rejected
  rather than left pending, and only then does the app sign out and redirect.

**Anything that links directly to a backend route outside of this Axios
instance — e.g. the Google/GitHub OAuth buttons, which are plain `<a href>`
tags rather than API calls — needs to build its URL the same way**
(`` `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/v1/auth/google` ``).
A hardcoded relative `href="/api/v1/auth/google"` will work locally (proxy
covers it) and then 404 in production, since Vercel has no `/api/v1/*`
route of its own. This bit the project once already — see `Login.tsx` /
`Register.tsx` for the corrected pattern if you're adding another OAuth-style
external link.

### Errors are translated in `lib/api-error.ts`

The backend's failure envelope (`{ statusCode, code, message, details[] }`) is
turned into one small object by `toApiError()`, and every page renders it with
`<ErrorState>` (a retry button, plus the stable `code` in monospace so a support
message like "`NOTE_NOT_FOUND`" means something to whoever reads it).

```ts
apiErrorMessage(err, 'Could not load your notes.')  // one-line toast copy
toApiError(err).offline                             // true = no response at all
toApiError(err).code                                // 'GITHUB_NOT_CONNECTED', …
```

Two rules worth keeping: prefer `code` over the message when the UI has to *behave*
differently (the import dialog keys off `GITHUB_NOT_CONNECTED`, not off the
sentence), and never render an empty list as if it were a success — a failed
`GET` and a genuinely empty vault are different states, and the pages now say so.

### Connection status comes from `GET /health`

`hooks/useBackendStatus.ts` polls the health endpoint (`degraded` = API up,
database down; `offline` = no answer at all) and `ui/BackendStatusPill.tsx`
renders it on the sign-in pages. It replaced a probe that POSTed dummy
credentials to `/auth/login` on every mount — which worked, but wrote a failed
login into the audit trail of anyone who opened the page.

### One route = one chunk

`App.tsx` wraps every page in `React.lazy`, and each layout has a `<Suspense
fallback={<RouteFallback />}>` around its `<Outlet />` — the shell stays on
screen and only the page area swaps. What that changed, measured with
`npm run build`:

| | before | after |
|---|---|---|
| entry chunk | 2,084 kB / 660 kB gzip | 478 kB / 150 kB gzip |
| Monaco, markdown editor, Recharts, three.js | in the entry chunk, before the sign-in form could paint | fetched with the route that uses them |

Two deliberate non-optimizations:

- **The editor modals stay in the Notes/Snippets chunk.** Splitting them out
  would cut the route's first load, but every click on "New note" would then
  stall on a 366 kB download. A slow first visit is survivable; a slow *button*
  feels broken. (`dist/assets/notesService-*.js`, ~1 MB, is
  `@uiw/react-md-editor`'s preview stack — react-markdown + lowlight with every
  language definition. That's the thing to attack if the notes route ever needs
  to get lighter, not the split points.)
- **`ColorBends` (three.js) is lazy inside `AuthLayout`**, with a static gradient
  underneath, because a decorative background should never delay a login form.
  It also probes for WebGL first: with hardware acceleration off — a VM, a
  headless run — `new THREE.WebGLRenderer()` throws from an effect and used to
  take the whole auth screen down with it.

Code splitting introduces one failure mode that didn't exist before: a deploy
replaces the hashed chunk files, a visitor still holds the old `index.html`, and
the import for the page they click 404s. `ui/RouteBoundary.tsx` catches that in
`main.tsx` and offers a reload instead of a blank page.

### Dialogs and the mobile drawer

Anything that behaves like a dialog says so: `ModalShell` owns Escape, the
backdrop click, `role="dialog"`, `aria-modal`, `aria-labelledby` and the initial
focus, and the older bespoke modals (notes, snippets, the project create/edit
form, the project detail edit form) carry the same attributes with
`hooks/useEscapeKey`. Two rules that are easy to get wrong and are enforced by
those components rather than by each page:

- **Escape and the backdrop go dead while a request is in flight.** A dismissed
  dialog that hides a save about to land is worse than a dialog that will not
  close.
- **The off-screen drawer is actually gone.** The mobile sidebar used to slide
  out with `translate-x-full`, which moves it out of sight but not out of the
  tab order — so keyboard users tabbed through the entire nav before reaching the
  page. It is now `inert` (and `aria-hidden`) while hidden, and
  `hooks/useMediaQuery` decides that from the same `lg` breakpoint the CSS uses,
  because "is this the drawer or the permanent sidebar?" cannot be answered from
  the `open` flag alone. Escape closes it, and the trigger reports
  `aria-expanded`.

No focus trap: the drawer is a disclosure, not a modal, and a trap there would
make it harder to leave, not easier.

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
  Query keys are the cache contract for invalidation after a write (and after
  an import, which invalidates `projects`, `notes`, `snippets`, `tasks` and
  `dashboard` in one go): `['projects']`, `['notes', { archived }]`,
  `['snippets', { projectId }]`, `['tasks', id]`, `['dashboard']`,
  `['github-repos']`.
- Dialogs that do work — not just display it — go through `ui/ModalShell.tsx`,
  which owns Escape, the backdrop click, `role="dialog"`/`aria-modal`/
  `aria-labelledby` and the initial focus. `dismissable={false}` while a
  request is in flight is what stops a stray Escape from looking like a
  cancelled import.

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
- **Settings** — profile form, GitHub connection, password change, danger zone
  (account deletion).
- **AI-assisted GitHub import** — see the next section.
- **Theme** — real dark/light toggle backed by CSS variables.

## What's not real yet

**API Collections** and **Password Vault** are design pages:
`pages/collections/CollectionsPage.tsx` lays out the intended feature set
(collections, environments, auth presets, history). The sidebar lists API
Collections with an inert "soon" link; Password Vault has no page and no route
at all. Neither has an endpoint behind it. They exist so the information
architecture is visible, not so anyone mistakes them for functionality.

## AI-assisted GitHub import

| Piece | Role |
|---|---|
| `services/importService.ts` | `listGithubRepos()`, `startImport(owner, repo, branch?)`, `getJob(id)`, `getLatestJob()`, plus the `ImportJob`/`ImportStage` types mirrored from the API |
| `hooks/useGithubImport.ts` | Starts a job, then polls it on a self-rescheduling timeout (no interval, so replies can't overlap), ignores results for a job id it stopped watching, and on mount re-attaches to `jobs/latest` if that job is still running |
| `components/projects/ImportGithubModal.tsx` | Repo picker with search → the checklist, progress bar, file/batch counters and `currentFile`; on completion it invalidates every affected query and navigates to the new project — unless the job came back with a `warning`, in which case it stops and shows what is missing |
| `components/ui/ModalShell.tsx` | Escape/backdrop/`aria-modal` handling, non-dismissable while the job runs |

The honest parts of this UI are deliberate: a partially analyzed import says so
instead of showing a green tick, `IMPORT_ALREADY_RUNNING` resumes the existing
job rather than erroring, and a repository that can't be found is a form error
before a job row exists.

## Getting started

```bash
npm install
npm run dev            # http://localhost:5000
```

No `.env` is needed for local development: `vite.config.ts` proxies `/api/*` to
`http://localhost:4000`, so the backend just has to be running (see
`Backend/README.md`). To talk to a backend somewhere else, set
`Frontend/.env` with `VITE_API_BASE_URL=http://localhost:4000` and the
proxy is bypassed entirely.

```bash
npm test               # vitest + jsdom — 20 tests
npm run lint           # eslint, zero warnings allowed
npm run build          # tsc -b, then vite build (prints the per-chunk sizes)
```

The suite is small on purpose, and each file earns its place:

- `src/lib/axios.spec.ts` — the refresh interceptor, including the deadlock
  regression. With the guard removed, two of the three hang until they time out
  instead of failing, which is what shows they aim at the right thing.
- `src/App.spec.tsx` — the real router, layouts and providers: a `React.lazy`
  route that never resolves, a Suspense boundary someone deletes, a dialog that
  loses its accessible name, and the mobile drawer losing its `inert` guard — all
  of which fail here rather than in a browser.
- `src/lib/api-error.spec.ts` — the envelope translation every page renders
  through: the stable `code`, validation `details` keyed by field, the offline
  case, and a proxy's 502 (answered and unreachable are still different advice).
- `src/services/notesService.spec.ts` — the query string, because "archived" is
  the API's job; the tab that got this wrong once is worth pinning down.

Nothing needs a running backend: the specs mock the transport or swap the axios
adapter for a local one.

## Deploying to Vercel (optional)

- **Root Directory** must be set to `Frontend` in the Vercel project
  settings (since the repo also contains `Backend/` at the same level).
- Set `VITE_API_BASE_URL` in **Settings → Environment Variables** for both
  **Production and Preview** environments — it's baked in at build time, so
  changing it always requires a redeploy, and Preview deployments won't pick
  up a Production-only value.
- `vercel.json` (see above) must be present for client-side routes to work
  on direct navigation instead of 404ing.
