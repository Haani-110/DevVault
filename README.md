# DevVault

An AI-ready developer productivity platform — notes, snippets, projects, API collections, credentials, and files in one dashboard.

## Project structure

```
/
├── Frontend/   React 19 + Vite + TypeScript
├── Backend/    NestJS 11 + Prisma + PostgreSQL
└── package.json  (root convenience scripts)
```

## Local setup

### 1. Install dependencies (both folders at once)

```bash
npm run setup
```

This installs Frontend and Backend dependencies. The Backend `postinstall` script runs `prisma generate` automatically.

### 2. Create the Backend environment file

Create `Backend/.env` (never commit this):

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/devvault"
JWT_ACCESS_SECRET="change-me-access"
JWT_REFRESH_SECRET="change-me-refresh"
```

Replace `USER` and `PASSWORD` with your local PostgreSQL credentials.

### 3. Create the database tables

```bash
cd Backend && npx prisma db push
```

### 4. Run the app

Open two terminals:

**Terminal 1 — Backend (port 4000):**
```bash
cd Backend && npm run start:dev
```

**Terminal 2 — Frontend (port 5000):**
```bash
cd Frontend && npm run dev
```

Open `http://localhost:5000` in your browser. The frontend proxies all `/api` requests to the backend automatically.

## API docs

Swagger UI is available at `http://localhost:4000/api/docs` when the backend is running.

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | — | hardcoded dev default | Sign access tokens |
| `JWT_REFRESH_SECRET` | — | hardcoded dev default | Sign refresh tokens |
| `JWT_ACCESS_EXPIRES_IN` | — | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRES_IN` | — | `7d` | Refresh token lifetime |
| `PORT` | — | `4000` | Backend port |
