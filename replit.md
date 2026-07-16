# DevVault

An AI-ready developer productivity platform — notes, snippets, projects, API collections, credentials, and files in one dashboard.

## Project structure

```
Frontend/   React 19 + Vite + TypeScript (auth, dashboard, notes, projects, settings)
Backend/    NestJS 11 + Prisma + PostgreSQL REST API
```

## How to run

Two workflows start automatically:

| Workflow | Command | Port |
|---|---|---|
| Start application | `cd Frontend && npm run dev` | 5000 |
| Start Backend | `cd Backend && npm run start:dev` | 4000 |

The Vite dev server proxies `/api/*` to `http://localhost:4000`, so the frontend and backend work together automatically.

## Backend stack

NestJS 11 · TypeScript · Prisma ORM · PostgreSQL (Replit built-in) · JWT (access 15m + refresh 7d) · Passport · bcrypt · class-validator · Swagger (docs at `/api/docs`)

## API endpoints (base: `/api/v1`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | — | Register new user |
| POST | `/auth/login` | — | Login |
| POST | `/auth/refresh` | — | Refresh access token |
| GET | `/notes` | ✓ | List user notes |
| POST | `/notes` | ✓ | Create note |
| PATCH | `/notes/:id/pin` | ✓ | Toggle pin |
| DELETE | `/notes/:id` | ✓ | Delete note |
| GET | `/projects` | ✓ | List projects |
| GET | `/projects/:id` | ✓ | Get project |
| POST | `/projects` | ✓ | Create project |
| GET | `/projects/:id/tasks` | ✓ | List project tasks |
| PATCH | `/tasks/:id` | ✓ | Move task (update status) |
| GET | `/dashboard/stats` | ✓ | Dashboard stats |

## Frontend stack

React 19 · Vite · TypeScript (strict) · Tailwind CSS · React Router · Zustand · TanStack Query · Axios · React Hook Form + Zod · Framer Motion · react-icons · Recharts · @monaco-editor/react · @uiw/react-md-editor · react-hot-toast

## Frontend services (all live — USE_MOCK = false)

- `authService` → `/auth/login`, `/auth/register`, `/auth/refresh`
- `notesService` → `/notes` CRUD
- `projectsService` → `/projects` + `/tasks` CRUD

## Database

Replit built-in PostgreSQL. Prisma schema in `Backend/prisma/schema.prisma`. Tables: `User`, `Note`, `Project`, `Task`.

To apply schema changes: `cd Backend && npx prisma db push`

## What's implemented (frontend + backend)

- Auth — register, login, JWT token refresh, protected routes
- Dashboard — stat cards, weekly activity chart, activity feed
- Notes — list, search, pin/favorite, markdown editor, delete
- Projects — grid with progress, Kanban board (drag & drop)
- Settings — profile form stub
- Dark/light theme toggle (persisted)

## What's stubbed (sidebar shows "Soon")

Snippets, API Collections, Password Vault, File Manager, Admin Panel

## User preferences

_None recorded yet._
