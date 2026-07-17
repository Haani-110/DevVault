# DevVault

An AI-ready developer productivity platform — notes, snippets, projects, API collections, credentials, and files in one dashboard.

## Stack

- **Frontend**: React 19 + Vite + TypeScript (port 5000)
- **Backend**: NestJS 11 + Prisma ORM + PostgreSQL (port 4000)

## Project structure

```
/
├── Frontend/   React 19 + Vite + TypeScript
├── Backend/    NestJS 11 + Prisma + PostgreSQL
└── package.json  (root convenience scripts)
```

## Running on Replit

Two workflows are configured and run automatically:

- **Start application** — `cd Frontend && npm run dev` (port 5000)
- **Start Backend** — `cd Backend && npm run start:dev` (port 4000)

The frontend proxies all `/api` requests to the backend at `http://localhost:4000`.

## Database

Uses Replit's built-in managed PostgreSQL. The `DATABASE_URL` environment variable is automatically provided. Schema was applied with:

```bash
cd Backend && npx prisma db push
```

## API docs

Swagger UI is available at `http://localhost:4000/api/docs` when the backend is running.

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | Auto-provided by Replit |
| `JWT_ACCESS_SECRET` | — | Has hardcoded dev default in `Backend/src/auth/auth.service.ts` |
| `JWT_REFRESH_SECRET` | — | Has hardcoded dev default in `Backend/src/auth/auth.service.ts` |
| `PORT` | — | Defaults to `4000` |

## User preferences

<!-- User preferences will be recorded here as needed -->
