# DevVault — Frontend

The frontend for DevVault, an AI-ready developer productivity platform (notes,
snippets, projects, API collections, credentials, files — one dashboard).

This is phase 1 of the full spec: **Auth + Dashboard shell + Notes + Projects/Tasks (Kanban)**,
built as a real, runnable app rather than a mockup. Every screen reads/writes through a
`services/*Service.ts` layer that currently talks to in-memory mock data — swap
`USE_MOCK = false` in each service once the NestJS API is live, and the UI needs no changes.

## Stack

React 19 · Vite · TypeScript (strict) · Tailwind CSS · React Router · Zustand ·
TanStack Query · Axios · React Hook Form + Zod · Framer Motion (installed, ready
for page-transition work) · react-icons · Chart.js/react-chartjs-2 (installed) ·
Recharts · @monaco-editor/react (installed, ready for the Snippets module) ·
@uiw/react-md-editor · react-hot-toast

## Getting started

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173. Sign in with any email + a 6+ character password —
auth is mocked, so any values succeed. The Vite dev server proxies `/api/*` to
`http://localhost:4000` (see `vite.config.ts`) for when the NestJS backend is ready.

> **Note on this delivery:** package installation requires npm registry access,
> which isn't available in the environment that generated this code, so the
> install/build hasn't been run end-to-end here. The source was written and
> reviewed carefully (strict TypeScript types, no stray `React.*` namespace
> references, consistent imports), but please run `npm install && npm run build`
> on your machine as a first step and report back anything that doesn't compile.

## What's implemented

- **Auth UI** — Login, Register, Forgot password, protected routes, persisted
  session via Zustand, Axios interceptor with access/refresh token flow wired
  (points at `/api/v1/auth/*` once `USE_MOCK` is flipped off).
- **Dashboard** — stat cards, weekly output chart (Recharts), storage/API usage
  gauges, recent activity feed.
- **Notes** — list, search/filter, tags, pin/favorite, markdown editor modal for
  creating notes, delete.
- **Projects** — project grid with progress bars, drill into a project for a
  drag-and-drop Kanban board (Backlog → In Progress → In Review → Done).
- **Settings** — profile form, danger zone stub.
- **Theme** — real dark/light toggle (CSS variables, not just a class with no
  effect), persisted, respects `prefers-reduced-motion`.
- **Design system** — token-based Tailwind config (`ink`/`surface`/`brass`/`mint`
  palette), a signature "vault dial" mark used as the logo and as a subtle tick
  pattern behind stat numbers, `JetBrains Mono` for all numeric/stat displays.

## What's stubbed for later phases

Snippets, API Collections, Password Vault, File Manager, Admin Panel, and
real-time notifications appear in the sidebar as "Soon" and aren't built yet —
building them against the same `services/` pattern is the next step once the
backend modules exist. Monaco Editor and Chart.js are already installed for
Snippets and Admin Panel analytics, respectively, since those modules will need
them.

## Project structure

```
src/
  components/   ui primitives, layout, and feature-specific components
  hooks/        useAuth, useTheme
  layouts/      AuthLayout, DashboardLayout
  lib/          axios instance + interceptors
  pages/        route-level screens
  routes/       ProtectedRoute
  services/     API layer (mock now, real endpoints later — one flag per file)
  store/        Zustand stores (auth, theme)
  styles/       Tailwind layers + design tokens
  types/        shared TS interfaces
```
