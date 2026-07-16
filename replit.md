# DevVault

An AI-ready developer productivity platform — notes, snippets, projects, API collections, credentials, and files in one dashboard.

## Project structure

```
Frontend/   React 19 + Vite + TypeScript frontend (the only piece built so far)
```

A NestJS backend is planned but not yet implemented. The frontend runs entirely on in-memory mock data — no backend or secrets required to run it.

## How to run

```bash
cd Frontend
npm install   # already done
npm run dev   # starts on port 5000
```

The "Start application" workflow handles this automatically.

## Frontend stack

React 19 · Vite · TypeScript (strict) · Tailwind CSS · React Router · Zustand · TanStack Query · Axios · React Hook Form + Zod · Framer Motion · react-icons · Recharts · @monaco-editor/react · @uiw/react-md-editor · react-hot-toast

## Mock vs real data

Each `Frontend/src/services/*Service.ts` has a `USE_MOCK` flag. Set it to `false` once the NestJS API is live — no UI changes needed.

## What's implemented

- Auth UI (login, register, forgot password) — any email + 6+ char password works
- Dashboard — stat cards, weekly output chart, gauges, activity feed
- Notes — list, search, tags, pin/favorite, markdown editor
- Projects — grid with Kanban board (drag-and-drop)
- Settings — profile form, danger zone stub
- Dark/light theme toggle (persisted)

## What's stubbed (sidebar shows "Soon")

Snippets, API Collections, Password Vault, File Manager, Admin Panel

## User preferences

_None recorded yet._
