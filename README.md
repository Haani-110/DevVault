# DevVault

A developer productivity SaaS application for organizing projects, notes, snippets, and developer resources in one place.

DevVault was built as a full-stack project to explore modern React and NestJS development, authentication, API design, database management, and AI-assisted development workflows.

## Overview

DevVault provides a centralized workspace where developers can manage their technical knowledge and project resources.

### Features

- Project management
- Developer notes
- Code snippets
- User authentication
- Dashboard statistics
- AI-assisted project note generation
- REST API architecture
- Persistent database storage

## Tech Stack

### Frontend

- React 19
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Zustand
- TanStack Query
- Axios
- React Hook Form
- Zod
- Framer Motion
- Monaco Editor

### Backend

- NestJS 11
- TypeScript
- Prisma
- PostgreSQL
- Swagger
- JWT Authentication

### AI

- Groq API

## Architecture

DevVault follows a separate frontend and backend architecture.

```text
Frontend (React + TypeScript)
        │
        │ REST API
        ▼
Backend (NestJS)
        │
        │ Prisma ORM
        ▼
PostgreSQL Database
        │
        └── AI integrations
```

The frontend communicates with the backend through REST APIs, while the backend handles authentication, validation, business logic, and database operations.

## Core Features

### Authentication

- User registration and login
- JWT-based authentication
- Protected application routes
- Persistent authentication state
- Automatic token refresh handling

### Projects

Create and manage development projects from a centralized dashboard.

Projects provide a workspace for organizing related developer resources.

### Notes

Create and organize technical notes with support for project association and archiving.

### Code Snippets

Save reusable code snippets with syntax highlighting and project organization.

### AI-Assisted Project Notes

DevVault can import information from a GitHub project and use an AI model to generate structured notes and useful development information.

This feature was built to explore practical AI integration inside a developer-focused application.

### Dashboard

The dashboard provides an overview of the user's developer workspace, including project and resource statistics.

## API

The backend exposes a versioned REST API:

```text
/api/v1
```

Swagger API documentation is available during local development at:

```text
/api/docs
```

## Project Structure

```text
DevVault/
├── Frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── lib/
│   │   └── ...
│   └── ...
│
├── Backend/
│   ├── src/
│   │   ├── auth/
│   │   ├── notes/
│   │   ├── projects/
│   │   ├── snippets/
│   │   └── ...
│   └── ...
│
└── README.md
```

## Running Locally

### Prerequisites

- Node.js
- npm
- PostgreSQL

### Backend

```bash
cd Backend
npm install
```

Create a `.env` file with the required database and authentication configuration.

Run Prisma migrations:

```bash
npx prisma migrate dev
```

Start the backend:

```bash
npm run start:dev
```

The backend runs on:

```text
http://localhost:4000
```

### Frontend

Open another terminal:

```bash
cd Frontend
npm install
npm run dev
```

Then open the local Vite development URL shown in the terminal.

## Environment Variables

Environment files are not included in the repository.

### Backend

```env
DATABASE_URL=
JWT_SECRET=
JWT_REFRESH_SECRET=
GROQ_API_KEY=
```

### Frontend

```env
VITE_API_BASE_URL=
```

Never commit real API keys, database credentials, or authentication secrets to the repository.

## Development Focus

The main purpose of DevVault was to practice building a complete full-stack application rather than only a frontend interface.

Key areas explored during development included:

- React application architecture
- TypeScript
- REST API design
- JWT authentication
- Prisma and PostgreSQL
- Database relationships
- React Query server state
- Form validation
- API error handling
- AI API integration
- GitHub API integration
- Developer-focused UI/UX
- Full-stack debugging

## AI-Assisted Development

DevVault was developed using an AI-assisted development workflow.

AI tools were used to support:

- Exploring implementation approaches
- Debugging errors
- Understanding unfamiliar APIs
- Reviewing code
- Improving UI implementation
- Troubleshooting frontend and backend integration

The project was not intended to represent an AI-generated application. Development involved implementing, testing, debugging, and making engineering decisions throughout the project.

## Current Status

DevVault is currently maintained as a development and portfolio project.

The project is not currently presented as a production-hosted application.

The repository remains available as a record of the project's architecture, implementation, and development process.

## What I Learned

Building DevVault provided practical experience with full-stack application development, especially around the boundary between frontend state management, backend APIs, and persistent data.

One of the most valuable parts of the project was working through integration and debugging issues across multiple layers of the application instead of treating the frontend and backend as separate projects.

## Author

**Haani Raza**

BS Computer Science  
DHA Suffa University

GitHub: **Haani-110**
