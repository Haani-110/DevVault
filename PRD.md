# DevVault — Product Requirements Document (PRD)

**Status:** Living document — reflects the product as of the current build.
**Owner:** Solo developer project (Haani).

---

## 1. Problem statement

Developers — especially freelancers and small teams — scatter their working
context across too many tools: notes in one app, snippets in another,
project/task tracking in a third, API testing in a fourth, and credentials
in a password manager or (worse) a text file. Switching between them costs
focus and makes it easy to lose track of small but important things: a
snippet you wrote three weeks ago, a note about why a workaround exists, a
credential you need for a client's staging server.

**DevVault's bet:** a single, fast, developer-native workspace for the
things developers currently keep in five different tabs.

## 2. Target users

- **Primary:** solo developers and freelancers juggling multiple client
  projects who want one place for notes/snippets/tasks without the overhead
  of a heavyweight PM tool (Jira, Notion, etc.).
- **Secondary:** small dev teams (2-6 people) who want lightweight shared
  project tracking without adopting an enterprise tool.

## 3. Product principles

1. **Fast over featureful.** Every core action (create a note, save a
   snippet, move a task) should take one or two clicks, no multi-step wizard.
2. **Developer-native content.** Snippets get a real code editor (Monaco)
   with language awareness, not a plain textarea. Notes support markdown.
3. **Own your data, but make onboarding painless.** Manual entry is the
   default, but the AI-import feature (see §6) exists to remove the
   "blank page" problem when starting fresh with an existing codebase.
4. **Works everywhere a developer works.** Desktop-first authoring, but
   fully usable on mobile for quick capture and status checks (see §7).

## 4. Current feature set (shipped)

### 4.1 Authentication
- Email + password registration and login.
- "Forgot password" flow: emailed reset link (SendGrid), single-use token,
  1-hour expiry. Deliberately returns the same response whether or not the
  email exists, to avoid leaking account existence.
- "Sign in with Google" and "Sign in with GitHub" — OAuth accounts resolve
  to the same `User` as an email/password account when emails match.
- JWT access + refresh token pair; refresh handled transparently by the
  frontend (401 → silent refresh → retry).

### 4.2 Notes
- Markdown notes with a title, content, and free-form tags.
- Pin, favorite, and archive states (independent booleans, not a single
  status field — a note can be pinned *and* archived at once by design).
- Search/filter by tab (all / pinned / favorites / archived) and tag.

### 4.3 Snippets
- Code snippets with title, description, language, code body (Monaco
  editor), and tags.
- Favorite state and language-based filtering.

### 4.4 Projects & Tasks
- Projects: name, description, color swatch.
- Tasks belong to a project: title, description, status, priority, optional
  due date and assignee.
- Kanban board per project: **Backlog → In Progress → In Review → Done**,
  drag-and-drop on desktop, dropdown-based status change on touch devices.
- Per-project stats (task counts per column, completion percentage).

### 4.5 Dashboard
- Aggregated stats (counts across notes/snippets/projects/tasks) and a
  weekly activity chart.

### 4.6 Settings
- Profile editing (username, avatar, bio, location, website, GitHub/LinkedIn
  links — email is immutable post-registration).
- Password change (with strength meter) for password-based accounts.
- Account deletion (danger zone, explicit confirmation step).

### 4.7 Cross-cutting: mobile support
- Off-canvas sidebar drawer with a hamburger toggle below the desktop
  breakpoint (`lg`).
- Touch-safe interactive affordances — action buttons that used to only
  appear on `:hover` are always visible on touch/narrow viewports.
- Responsive form grids, toolbars, and modals; no fixed-pixel-width elements
  that could force horizontal scrolling on a phone.

## 5. Designed but not yet built

These have UI placeholders ("coming soon" screens) so the product's shape is
visible, but no backend behind them yet:

- **API Collections** — a lightweight, Postman-style tool for organizing and
  running saved API requests per project.
- **Password Vault** — encrypted credential storage (site/service, username,
  password, notes) scoped per user or per project.

Both are logical next builds once the AI-import feature (below) lands, since
they follow the same "domain module + Prisma model + CRUD controller"
pattern already established by Notes/Snippets/Projects.

## 6. In progress: AI-assisted GitHub import

**Problem it solves:** starting a new DevVault project from an existing
codebase currently means manually writing every note and copying every
snippet by hand — exactly the tedium DevVault is supposed to eliminate.

**Feature:** a user picks one of their own GitHub repositories (reusing the
GitHub OAuth token already stored from login — no separate GitHub App
needed). DevVault fetches the repo's file tree and relevant file contents,
sends them to the Claude API with a prompt asking for structured JSON, and
persists the result as:
- **Notes** — one per logical file/module, explaining what it does and any
  gotchas, not just restating the code.
- **Snippets** — genuinely reusable pieces (utilities, hooks, middleware,
  config patterns), each tagged and language-labeled.

Both get attached to a new `Project` created for the import (via an
optional `projectId` on `Note`/`Snippet`), so the repo becomes a
pre-populated workspace rather than a blank one.

**Explicitly out of scope for v1 of this feature:**
- Private-repo write-back (this is read-only import, not two-way sync).
- Re-importing/diffing an already-imported repo (each import is a one-time
  snapshot for now).
- Automatic periodic re-sync.

## 7. Non-goals

- DevVault is not trying to replace a full issue tracker (no epics,
  sprints, or cross-project reporting) or a full password manager (no
  browser extension autofill, no breach monitoring) — it deliberately stays
  lightweight rather than growing into either.
- No real-time multiplayer/collaboration (no live cursors, no comments) in
  the current scope — Projects/Tasks are single-user-owned today, even
  though the schema could support sharing later.
- No native mobile app — "mobile support" means a responsive web app, not a
  packaged iOS/Android client.

## 8. Success signals (qualitative, pre-metrics stage)

Since this is an early-stage solo/small-team product without instrumented
analytics yet, success today is judged by:
- A user can go from "empty account" to "day-to-day use" without hitting a
  broken flow (auth, note/snippet/task CRUD, dashboard).
- The mobile experience doesn't have any dead-end interactions (buttons that
  can't be reached, drag interactions with no touch equivalent).
- The AI-import feature (once shipped) measurably reduces the time to a
  populated, useful project compared to manual entry.

## 9. Key risks / open questions

- **AI import cost/latency at scale:** large repos need file filtering and
  possibly chunked multi-call analysis; current design caps the payload
  sent to Claude per import (see `Architecture.md` and `DDS.md`).
- **GitHub OAuth scope:** the `repo` scope needed for import is broader than
  the `user:email` scope originally requested — existing users who
  connected GitHub before this change need to reconnect.
- **Two-deployment operational overhead:** Railway (backend) and Vercel
  (frontend) being fully independent means environment variables, CORS, and
  OAuth callback URLs must all be kept in sync by hand across two dashboards
  — a recurring source of "works locally, breaks in prod" bugs during this
  project's early deployment (see `Architecture.md` §6).
