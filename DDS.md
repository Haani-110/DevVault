# DevVault — DDS.md (Detailed Design Specification)

Covers the data model, API contracts, and key business-logic flows in
enough detail to implement against without reading the source first. See
`Architecture.md` for the higher-level system view and `PRD.md` for why
these features exist.

---

## 1. Data model (current, implemented schema)

```prisma
enum Role { ADMIN DEVELOPER GUEST }
enum TaskStatus { BACKLOG IN_PROGRESS IN_REVIEW DONE }
enum TaskPriority { LOW MEDIUM HIGH URGENT }

User
├─ id, email (unique), username (unique)
├─ passwordHash (nullable — null for OAuth-only accounts)
├─ avatarUrl, bio, location, website, githubUrl, linkedinUrl (all nullable)
├─ role: Role = DEVELOPER
├─ createdAt, updatedAt
└─ has many: Note, Project, Task, Snippet, PasswordReset, OAuthAccount

Note
├─ id, userId → User (cascade delete)
├─ title, content, tags: String[]
├─ isPinned, isFavorite, isArchived: Boolean (independent flags — see §4.1)
└─ createdAt, updatedAt

Snippet
├─ id, userId → User (cascade delete)
├─ title, description (nullable), code, language = "plaintext"
├─ tags: String[], isFavorite: Boolean
└─ createdAt, updatedAt

Project
├─ id, userId → User (cascade delete)
├─ name, description (nullable), color = "#6366f1"
├─ has many: Task
└─ createdAt, updatedAt

Task
├─ id, projectId → Project (cascade delete), userId → User
├─ title, description (nullable)
├─ status: TaskStatus = BACKLOG, priority: TaskPriority = MEDIUM
├─ dueDate (nullable), assignee (nullable, plain string — not a User FK)
└─ createdAt, updatedAt

OAuthAccount
├─ id, userId → User (cascade delete)
├─ provider ("google" | "github"), providerUid
├─ accessToken, refreshToken (nullable)
├─ unique constraint: (provider, providerUid)
└─ createdAt, updatedAt

PasswordReset
├─ id, userId → User (cascade delete)
├─ token (unique), expiresAt, used: Boolean = false
└─ createdAt
```

### 1.1 Design rationale for non-obvious fields

- **`Note`'s three booleans instead of one status enum.** Pinned, favorite,
  and archived are orthogonal concerns — a user might archive a note they
  still want pinned for quick reference, or favorite something they've
  archived. Modeling this as a single `NoteStatus` enum would force an
  artificial priority ordering between concepts that don't have one.
- **`Task.assignee` is a plain string, not a `User` relation.** Projects
  currently have exactly one owner (`userId`) and no membership model —
  there's no multi-user collaboration yet (see `PRD.md` §7, non-goals). The
  field exists so the Kanban card UI has somewhere to show a name, but it's
  intentionally unstructured until real project membership is designed.
- **`OAuthAccount.accessToken` is retained post-login**, not discarded
  after the OAuth handshake completes. This is specifically so the stored
  GitHub token can be reused later by the AI-import feature to read a
  user's repos, without a second consent screen. See §5 for the planned
  scope implication.
- **`PasswordReset` is an append-only log, not a single field on `User`.**
  Keeping historical (expired/used) reset tokens as rows rather than
  overwriting a single `resetToken` field on `User` means a reset request
  can't invalidate an in-flight one from another tab/device by accident,
  and gives an audit trail of reset attempts if abuse needs investigating
  later.

## 2. API reference

Base path: `/api/v1`. All routes require `Authorization: Bearer <access
token>` **except** those marked public below. Swagger UI (auto-generated
from the same DTOs/decorators) is available at `/api/docs`.

### 2.1 Auth (`/auth`) — all public except `change-password`

| Method | Path | Purpose |
|---|---|---|
| POST | `/register` | Create a password-based account, returns token pair |
| POST | `/login` | Authenticate with email + password, returns token pair |
| POST | `/refresh` | Exchange a valid refresh token for a new access token |
| POST | `/logout` | No-op server-side; client discards tokens (stateless JWT, no server-side session to invalidate) |
| POST | `/change-password` | **Requires auth.** Change password while logged in |
| POST | `/forgot-password` | Request a reset email. Always returns a generic success message (see §4.3) |
| POST | `/reset-password` | Consume a reset token, set a new password |
| GET | `/google` | Redirects to Google's OAuth consent screen |
| GET | `/google/callback` | Google redirects here; issues token pair, redirects to `FRONTEND_URL` |
| GET | `/github` | Redirects to GitHub's OAuth consent screen |
| GET | `/github/callback` | GitHub redirects here; issues token pair, redirects to `FRONTEND_URL` |

### 2.2 Users (`/users`) — auth required

| Method | Path | Purpose |
|---|---|---|
| GET | `/me` | Current user's profile |
| PATCH | `/profile` | Update profile fields (not email) |
| DELETE | `/account` | Permanently delete the account and all owned data (cascades) |

### 2.3 Notes (`/notes`) — auth required

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | List the current user's notes |
| POST | `/` | Create a note |
| PATCH | `/:id` | Update title/content/tags |
| PATCH | `/:id/pin` | Toggle `isPinned` |
| PATCH | `/:id/favorite` | Toggle `isFavorite` |
| PATCH | `/:id/archive` | Toggle `isArchived` |
| DELETE | `/:id` | Delete a note |

### 2.4 Snippets (`/snippets`) — auth required

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | List the current user's snippets |
| POST | `/` | Create a snippet |
| PATCH | `/:id` | Update any snippet field |
| PATCH | `/:id/favorite` | Toggle `isFavorite` |
| DELETE | `/:id` | Delete a snippet |

### 2.5 Projects (`/projects`) — auth required

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | List the current user's projects |
| GET | `/:id` | Get one project |
| POST | `/` | Create a project |
| PATCH | `/:id` | Update name/description/color |
| DELETE | `/:id` | Delete a project **and cascade-delete its tasks** |
| GET | `/:id/tasks` | List tasks belonging to a project |

### 2.6 Tasks (`/tasks`) — auth required

| Method | Path | Purpose |
|---|---|---|
| POST | `/project/:projectId` | Create a task under a project |
| PATCH | `/:id` | Update a task — this is also how the Kanban board moves a card (updates `status`) |
| DELETE | `/:id` | Delete a task |

### 2.7 Dashboard (`/dashboard`) — auth required

| Method | Path | Purpose |
|---|---|---|
| GET | `/stats` | Aggregated counts + recent activity for the current user |

## 3. Authentication design

### 3.1 Token pair

- **Access token:** short-lived (`JWT_ACCESS_EXPIRES_IN`, default `15m`),
  sent as `Authorization: Bearer` on every protected request.
- **Refresh token:** long-lived (`JWT_REFRESH_EXPIRES_IN`, default `7d`),
  used only to mint a new access token via `/auth/refresh`.
- Signed with **separate secrets** (`JWT_ACCESS_SECRET` /
  `JWT_REFRESH_SECRET`) so a leaked access token can't be used to forge a
  refresh, and vice versa.

### 3.2 Frontend refresh flow (see `Architecture.md` §2 for why it's centralized)

```
Request → 401
        → is a refresh already in-flight?
            yes → queue this request, wait for it to resolve
            no  → call /auth/refresh
                    success → update stored tokens → retry all queued requests
                    failure → clear session → redirect to /login
```

### 3.3 OAuth account linking

```
User clicks "Sign in with Google/GitHub"
  → provider consent screen
  → callback hits /auth/{provider}/callback with profile { email, providerUid, ... }
  → look up OAuthAccount by (provider, providerUid)
      found → use its linked User
      not found → look up User by email
          found → create a new OAuthAccount linked to that existing User
                   (this is the "linking" step — a password-registered user
                   who later uses Google/GitHub with the same email doesn't
                   get a duplicate account)
          not found → create a new User (no passwordHash) + OAuthAccount
  → issue access + refresh token pair for that User
  → redirect to `${FRONTEND_URL}/oauth/callback?accessToken=...&refreshToken=...`
```

### 3.4 Password reset

```
POST /forgot-password { email }
  → look up User by email
      found → create PasswordReset { token: random, expiresAt: now+1h }
              → send email via SendGrid with link:
                `${FRONTEND_URL}/reset-password?token=...`
      not found → do nothing
  → respond with the SAME generic message either way
    ("If that email exists, a reset link has been sent.")

POST /reset-password { token, newPassword }
  → look up PasswordReset by token
      invalid / expired / already used → 400
      valid → hash newPassword → update User.passwordHash
              → mark PasswordReset.used = true
              → respond success
```

**Why the generic response matters:** this is intentionally the one place
in the API where the response can't be used to test whether an email is
registered. Anyone debugging "reset email never arrived" needs to check
**server logs**, not the HTTP response — see `Backend/README.md` for the
exact log lines to look for.

## 4. Key business logic notes

### 4.1 Note flags are independent, not a state machine
`isPinned`, `isFavorite`, `isArchived` can be any combination of true/false.
The frontend's tab filter (`all / pinned / favorites / archived`) is a
client-side filter over these three booleans, not a server-side "status"
concept — there is no `GET /notes?status=archived` endpoint; filtering
happens against the same full list.

### 4.2 Task status updates and the Kanban board
There's no separate "move task" endpoint — `PATCH /tasks/:id` accepts a
partial update including `status`, and the Kanban UI calls this same
endpoint whether a card was dragged (desktop) or reassigned via the
touch-friendly status dropdown (mobile). Both interaction methods produce
identical API calls; the touch/desktop split is purely a frontend
interaction detail, not a backend one.

### 4.3 Cascade deletes
- Deleting a `User` cascades to all of their Notes, Snippets, Projects,
  Tasks, OAuthAccounts, and PasswordResets — a full account deletion is a
  single Prisma cascade, not a manual multi-table cleanup.
- Deleting a `Project` cascades to its `Task`s (a task can't outlive its
  project). Notes and Snippets are not currently attached to Projects at
  all in the shipped schema (see §5) so this cascade doesn't affect them.

## 5. Planned schema changes (AI-import feature — not yet migrated)

To support grouping AI-generated content under the project it was imported
from, the following additive, backward-compatible changes are planned:

```prisma
model Note {
  // ...existing fields...
  projectId String?
  project   Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)
}

model Snippet {
  // ...existing fields...
  projectId String?
  project   Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)
}

model Project {
  // ...existing fields...
  sourceRepo String?     // e.g. "owner/repo", set only for AI-imported projects
  notes      Note[]
  snippets   Snippet[]
}
```

These are additive and nullable — existing Notes/Snippets are unaffected
(they simply have `projectId = null`), so this requires no data migration
beyond `prisma db push`/`prisma migrate`.

**Also required for this feature (not yet applied to the live repo):**
- GitHub OAuth scope needs to widen from `user:email` to `user:email repo`
  so the stored `OAuthAccount.accessToken` can read repository contents,
  not just profile info. Users who connected GitHub before this change will
  need to reconnect to get a token with the wider scope.
- New `ANTHROPIC_API_KEY` environment variable for the `ai` module.
- New `ai` module (Claude API wrapper) and `import` module (GitHub fetch +
  orchestration) — see `Architecture.md` §3 for their intended shape.

## 6. Validation & error conventions

- All request bodies are validated via `class-validator` DTOs
  (`CreateNoteDto`, `RegisterDto`, etc.) — invalid input returns `400` with
  a field-level error array from Nest's built-in `ValidationPipe`.
- Ownership checks happen at the service layer: every read/update/delete by
  `:id` re-scopes the Prisma query by the authenticated `userId` (e.g.
  `prisma.note.findFirst({ where: { id, userId } })`), so a user can never
  fetch or mutate another user's row even with a guessed ID — a `404` (not
  a `403`) is returned in that case, to avoid confirming the ID's existence
  to someone probing it.
- Auth failures (`JwtAuthGuard`) return `401`.
