# DevVault — Architecture.md

High-level system architecture: how the pieces fit together and talk to
each other, and why the deployment is shaped the way it is.

---

## 1. System overview

```
┌─────────────────────────┐        HTTPS (JSON over REST)        ┌──────────────────────────┐
│   Frontend (Vercel)     │ ───────────────────────────────────▶ │   Backend (Railway)      │
│   React 19 + Vite SPA   │ ◀─────────────────────────────────── │   NestJS 11 API          │
└─────────────────────────┘                                      └──────────┬───────────────┘
                                                                             │
                                                        ┌────────────────────┼─────────────────────┐
                                                        ▼                    ▼                     ▼
                                              ┌──────────────────┐ ┌─────────────────┐   ┌─────────────────┐
                                              │ PostgreSQL        │ │ SendGrid         │   │ Google / GitHub  │
                                              │ (Railway addon)   │ │ (transactional   │   │ OAuth providers  │
                                              │ via Prisma ORM    │ │  email)          │   │                  │
                                              └──────────────────┘ └─────────────────┘   └─────────────────┘
                                                                                                    │
                                                                                          ┌──────────────────┐
                                                                                          │ Anthropic (Claude │
                                                                                          │ API) — AI import  │
                                                                                          │ feature, in build │
                                                                                          └──────────────────┘
```

Two independently deployable, independently scalable applications
communicating only over HTTPS. There is no shared filesystem, no shared
process, and no server-side rendering bridging them.

## 2. Frontend architecture

**Stack:** React 19, Vite, TypeScript (strict), Tailwind CSS, React Router
(client-side routing, `BrowserRouter`), Zustand (client state), TanStack
Query (server state/caching), Axios (HTTP), React Hook Form + Zod
(forms/validation), Monaco Editor (snippet code), `@uiw/react-md-editor`
(note markdown), Recharts (dashboard chart), react-icons, react-hot-toast.

**Structure:**
```
Frontend/src/
├── layouts/          # AuthLayout (split-screen auth pages), DashboardLayout (sidebar+navbar shell)
├── pages/            # One folder per feature area (auth, dashboard, notes, snippets, projects, collections, vault)
├── components/       # Reusable UI, organized by domain (layout, notes, snippets, projects, dashboard, ui, 3d)
├── services/         # Thin wrappers per domain over the shared Axios instance (authService, notesService, ...)
├── store/            # Zustand stores: authStore (persisted), themeStore (persisted)
├── hooks/            # useAuth, useTheme, etc. — thin hooks over the stores/services
├── lib/axios.ts      # Single configured Axios instance + token refresh interceptor
└── styles/globals.css
```

**Key architectural decisions:**

- **Single Axios instance, single source of truth for the API base URL.**
  `VITE_API_BASE_URL` (set at build time by Vite) plus `/api/v1` is the only
  place the backend's location is known. Anything that talks to the backend
  outside this instance (e.g. the OAuth `<a href>` buttons, which are plain
  links rather than fetch/axios calls, since they need a full page
  navigation for the OAuth redirect dance) must build its URL the same way,
  or it breaks in production while still working in local dev (this bit the
  project once already — see the OAuth button fix in project history).

- **Token refresh is handled once, centrally.** A 401 response triggers a
  single in-flight `/auth/refresh` call; any other request that 401s while
  that's in-flight is queued and retried once a new token is issued, rather
  than each caller independently trying to refresh (which would race).

- **Client-side routing requires a hosting-level rewrite.** Because
  `react-router-dom` owns navigation in-browser, a direct hit to a path like
  `/reset-password?token=...` (e.g. from an email link) isn't a real file on
  Vercel's static host. `Frontend/vercel.json` rewrites all paths to
  `index.html` so React Router can take over. Without it, any route besides
  `/` 404s on direct navigation or refresh.

- **Mobile is a first-class breakpoint, not an afterthought.** The
  dashboard shell (`DashboardLayout` + `Sidebar` + `Navbar`) is built around
  a mobile-first off-canvas drawer pattern: the sidebar is `fixed` and
  translated off-screen below the `lg` breakpoint, toggled by a hamburger
  button that only renders below `lg`. Interactive affordances that used to
  rely on CSS `:hover` (action buttons revealed on card hover) are always
  visible below `sm`, since touch devices have no hover state. Drag-and-drop
  (Kanban board) has a non-drag fallback (a status `<select>`) because
  HTML5 `draggable` doesn't work on touchscreens at all.

## 3. Backend architecture

**Stack:** NestJS 11 (modular, decorator-based), Prisma ORM, PostgreSQL,
Passport (JWT + OAuth strategies), class-validator/class-transformer (DTO
validation), Swagger (`@nestjs/swagger`) for auto-generated API docs,
`@sendgrid/mail` for email, bcrypt for password hashing.

**Module map** (one module per domain, each with its own controller,
service, and DTOs):

```
Backend/src/
├── auth/          # Register/login/refresh/logout, password reset, Google/GitHub OAuth
│   ├── strategies/    # Passport strategies: jwt, google, github
│   └── guards/        # JwtAuthGuard, GoogleAuthGuard, GithubAuthGuard
├── users/         # Profile read/update, account deletion
├── notes/         # Notes CRUD + pin/favorite/archive toggles
├── snippets/      # Snippets CRUD + favorite toggle
├── projects/      # Projects CRUD
├── tasks/         # Tasks CRUD, scoped to a project (Kanban data)
├── dashboard/     # Aggregated read-only stats endpoint
├── email/         # SendGrid wrapper (currently: password-reset emails only)
├── prisma/        # Global PrismaModule/PrismaService (single shared client)
├── common/        # Shared decorators (e.g. @CurrentUser) and guards
├── ai/            # (in progress) Claude API wrapper for repo analysis
└── import/        # (in progress) GitHub repo listing/fetching, orchestrates ai + persistence
```

**Request lifecycle:** every route except
`register/login/refresh/forgot-password/reset-password/google*/github*` is
behind `JwtAuthGuard`. A custom `@CurrentUser()` param decorator pulls
`{ userId, email, role }` off the validated JWT payload so controllers never
touch `req.user` directly.

**Auth model in more detail:**
- Password accounts: bcrypt hash on `User.passwordHash`.
- OAuth accounts: a separate `OAuthAccount` row per provider connection,
  unique on `(provider, providerUid)`, linked to a `User`. Login via OAuth
  looks up an existing `User` by email first (so a user who registered with
  a password and later clicks "Sign in with Google" using the same email
  gets linked to the same account, not a duplicate one).
- Both paths issue the same JWT pair (access: short-lived, refresh:
  long-lived, separate signing secrets).
- `OAuthAccount.accessToken` is retained specifically so the GitHub token
  can be reused later for the AI-import feature — no second OAuth
  consent flow is needed to read a user's repos.

**Why some endpoints are deliberately uninformative:** `forgot-password`
returns an identical success response regardless of whether the email
exists, to prevent user enumeration. This means debugging "email didn't
arrive" issues has to happen via **server logs**, not the API response — a
recurring point of confusion during this project's early debugging that's
worth remembering for any new endpoint with the same shape.

## 4. Data layer

See `DDS.md` for the full schema and field-level rationale. In brief:
Postgres via Prisma, one `User` fanning out to `Note`, `Snippet`, `Project`
(which fans out to `Task`), `OAuthAccount`, and `PasswordReset`. Notes and
Snippets have an optional `projectId` specifically to support the AI-import
feature grouping generated content under the project it came from, while
manually created notes/snippets remain unattached to any project by default.

## 5. Third-party integrations

| Service | Purpose | Where it's called from |
|---|---|---|
| SendGrid | Transactional email (password reset) | `email/email.service.ts` |
| Google OAuth | Social login | `auth/strategies/google.strategy.ts` |
| GitHub OAuth | Social login **and** (planned) repo read access for AI import | `auth/strategies/github.strategy.ts` |
| Anthropic (Claude API) | Generates notes/snippets from imported repo source | `ai/ai.service.ts` (in progress) |

All are optional at the code level in the sense that the app degrades
gracefully without credentials configured (email falls back to console
logging in dev; AI endpoints return a clear "not configured" error) rather
than crashing — this was a deliberate choice to make local development
possible without every third-party key on hand.

## 6. Deployment topology and its consequences

**Backend → Railway.** Builds via `nixpacks.toml`/`railway.toml`
(`npm install` → `npm run build` → `npm run start:prod`). All secrets live
in Railway's **Variables** tab; Railway does not read committed `.env`
files (correctly — they're gitignored).

**Frontend → Vercel.** Builds from `Frontend/` (Root Directory setting).
`VITE_API_BASE_URL` is a **build-time** value baked into the static bundle
by Vite — meaning it must be set per-environment (Production *and*
Preview) in Vercel's dashboard, and any change requires a redeploy, not just
a variable update.

**Why this split matters operationally:** because the two apps live on
different domains in production, several things that "just work" in local
dev (where Vite's dev server proxies `/api/*` to `localhost:4000`, making
the two look same-origin) need explicit handling in prod:
- CORS must allow the deployed frontend origin.
- OAuth callback URLs registered with Google/GitHub must point at the
  Railway domain, not localhost.
- `FRONTEND_URL` (backend env var) must point at the Vercel domain, since
  it's used to build password-reset links and post-OAuth redirect targets.
- Any hardcoded relative link to a backend route (rather than one going
  through the Axios instance or built from `VITE_API_BASE_URL`) will 404 in
  production while working locally — this exact bug hit the OAuth login
  buttons early in this project and is the main "gotcha" to watch for when
  adding any new direct backend link.

This project's actual deployment history is a working case study of this
class of bug: SendGrid env vars missing on Railway, a missing
`vercel.json` causing SPA-route 404s, and hardcoded OAuth links breaking in
production are all instances of the same root cause — **local dev's
same-origin illusion not existing once the app is actually deployed as two
separate services.**
