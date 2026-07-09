# Sprintboard — Implementation Plan

A sprint board + task tracking + team wiki app for a small team (≈4 people),
non‑commercial, with an offline / no‑login local mode. Built to deploy on the
Vercel Hobby (free) tier with MongoDB Atlas.

> **Status legend:** ✅ done · 🚧 in progress · ⬜ planned

---

## 1. Tech stack (verified against context7)

| Concern | Choice | Version (installed) |
| --- | --- | --- |
| Framework | Next.js App Router, TypeScript | **16.2.10** |
| UI runtime | React | 19.2.4 |
| Styling | Tailwind CSS | v4 |
| Components | shadcn/ui (Radix base, "nova" preset) + lucide icons | radix-nova |
| Auth | Auth.js / NextAuth (Credentials + JWT) | 5.0.0‑beta.31 |
| Database | MongoDB (official Node driver) | mongodb 7.x |
| Passwords | bcryptjs | 3.x |
| Validation | zod | 4.x |
| Theming | next-themes | latest |
| Hosting | Vercel Hobby + MongoDB Atlas M0 | — |

### Notable Next.js 16 specifics baked in
- **`middleware.ts` → `proxy.ts`** (function renamed `middleware` → `proxy`). Route
  protection lives in `src/proxy.ts`.
- **Async request APIs** — `cookies`, `headers`, `params`, `searchParams` are
  async‑only; all reads `await` them.
- Turbopack is the default builder, but 16.2.10's Turbopack crashes on the
  Tailwind v4 PostCSS worker, so `dev`/`build` use `--webpack`. `dev:turbo` /
  `build:turbo` remain for when the upstream fix lands.

---

## 2. Architecture

### Directory layout (`src/`)
```
env.ts                     Type-safe, zod-validated environment access
auth.config.ts             Edge-safe Auth.js config (callbacks, route protection)
auth.ts                    Full Auth.js (Credentials provider + JWT) — Node runtime
proxy.ts                   Next.js 16 proxy → JWT route protection (edge)
types/next-auth.d.ts       Session/JWT type augmentation

lib/
  db/
    mongodb.ts             Cached MongoClient singleton (serverless-safe)
    collections.ts         Typed collection accessors + collection names
    indexes.ts             ensureIndexes() (idempotent) + stale-index cleanup
  models/                  One file per entity: XDoc (DB) + X (DTO) + serializeX + zod
    enums.ts               ⚠ dependency-free: statuses + priorities (client-safe)
    epic-progress.ts       ⚠ dependency-free: rollupEpicStatus / computeEpicProgress
    common.ts user.ts workspace.ts sprint.ts epic.ts task.ts wiki.ts index.ts
  auth/
    local-mode.ts          isLocalMode() + fixed local ids (edge-safe)
    local-context.ts       ensureLocalUser()/ensureLocalWorkspace()
    credentials.ts         hashPassword/verifyPassword + authorize()
  queries/
    board.ts               getBoardData() — sprint + epic rows + bucketed tasks
  actions/
    types.ts               ActionResult discriminated unions
    auth.ts                register / login / logout Server Actions
    epics.ts               createEpic / deleteEpic (cascades tasks)
    tasks.ts               createTask / moveTask / deleteTask
  board-types.ts           BoardRow/BoardData + cell-id encode/decode (pure)
  board-state.ts           Pure, immutable drag transitions (findTaskLocation, moveTask)
  session.ts               getCurrentUser / requireUser / getCurrentContext
  workspace.ts             getWorkspaceForUser / createWorkspaceForUser
  navigation.ts format.ts utils.ts

components/
  providers.tsx theme-toggle.tsx coming-soon.tsx
  app-shell/  sidebar.tsx  user-menu.tsx
  board/      board-grid.tsx (DndContext) board-cell.tsx task-card.tsx
              epic-row-header.tsx quick-add-task.tsx sprint-switcher.tsx
              create-epic-dialog.tsx badges.tsx
  ui/         (shadcn components)

app/
  layout.tsx page.tsx globals.css
  api/auth/[...nextauth]/route.ts
  (auth)/    layout.tsx login/ register/
  (app)/     layout.tsx dashboard/ board/ tasks/ wiki/ members/ settings/

scripts/  load-env.ts  seed.ts
```

### Layering rules
1. **Models** define the data contract: a `*Doc` (Mongo shape with `ObjectId`/`Date`),
   a plain `*` DTO (string ids / ISO dates, safe across the RSC boundary), a
   `serializeX()` mapper, and zod schemas for input.
2. **Data access** goes through `lib/db/collections.ts` (typed) — never a raw
   string collection name.
3. **Server Components / Server Actions** read/write via the db + session helpers.
   Client Components receive only serialized DTOs.
4. **Auth is split** into an edge‑safe `auth.config.ts` (used by `proxy.ts`, no DB)
   and the full `auth.ts` (Credentials + bcrypt + Mongo, Node runtime only). This
   keeps the edge proxy from bundling Node‑only modules.

### Authentication model
- Email + password, hashed with bcrypt, stored in the `users` collection.
- **JWT sessions** (Credentials cannot use database sessions), so no Auth.js
  `accounts`/`sessions` collections are needed.
- `id` and `role` are copied onto the JWT and exposed on `session.user`.
- Route protection is enforced by the `authorized` callback in `proxy.ts`.

### LOCAL_MODE (offline / no‑login)
When `LOCAL_MODE=true`:
- The proxy `authorized` callback returns `true` for everything (no login wall).
- `getCurrentUser()`/`getCurrentContext()` return a singleton **local user +
  workspace** (fixed ids, created on demand) instead of reading a session.
- The login/register pages redirect to the dashboard; sign‑out is hidden.
This is the "just run it on my machine" path for a self‑hoster who doesn't want
accounts. Everything else (board, tasks, wiki) works identically.

---

## 3. Data model (MongoDB)

The board is a **grid**: each **epic** is a row, each **status** is a column, and
the **tasks** inside an epic are the cards laid out across those columns.

```
            │  New   │  Active  │ Resolved │  Closed
────────────┼────────┼──────────┼──────────┼──────────
 Epic A     │ [task] │  [task]  │          │  [task]
 Epic B     │ [task] │          │  [task]  │
```

| Collection | Key fields | Indexes |
| --- | --- | --- |
| `users` | email (unique, lowercased), name, passwordHash?, image?, role | `{email}` unique |
| `workspaces` | name, slug (unique), members[]:{userId, role, joinedAt} | `{slug}` unique, `{members.userId}` |
| `sprints` | workspaceId, name, goal?, status(planned/active/completed), start/endDate | `{workspaceId,status}` |
| `epics` | workspaceId, sprintId\|null, title, description?, priority, assigneeIds[], reporterId, labels[], order, dueDate? | `{workspaceId,sprintId,order}` |
| `tasks` | workspaceId, **epicId**, title, description?, status, priority, assigneeIds[], reporterId, labels[], order, dueDate? | `{workspaceId,epicId,status,order}`, `{epicId}`, `{assigneeIds}` |
| `wikiPages` | workspaceId, title, slug, content(md), parentId\|null, authorId, updatedById | `{workspaceId,slug}` unique, `{workspaceId,parentId}` |

- **Board columns == task `status`**: `new · active · resolved · closed`.
- **Every task belongs to exactly one epic** (`epicId` is required). Tasks inherit
  their sprint from that epic.
- **An epic has no stored status.** It is *derived* from its tasks by
  `rollupEpicStatus()`: no tasks → `new`; all closed → `closed`; all
  resolved/closed → `resolved`; any progress → `active`; else `new`. The row also
  shows `closed/total` progress. The same pure function runs on the server and in
  the browser, so the badge updates live mid‑drag.
- `sprintId: null` on an epic ⇒ it's in the backlog (`/board?sprint=backlog`).
- **`order`** sorts cards within an `(epicId, status)` cell. A drag sends the
  destination cell's final ordered id list; the server rewrites `order` from the
  array indices. That makes moves idempotent and avoids fractional‑index drift —
  a status change, a re‑parent, and a reorder are all the same write.
- Indexes are created idempotently by `ensureIndexes()` (run from `npm run seed`),
  which also drops indexes left over from the pre‑Epic schema.

---

## 4. Milestones

### ✅ M0 — Foundation & setup *(this session)*
Scaffold + everything needed to build features on top.
- Next.js 16 + TS + Tailwind v4 + shadcn/ui scaffolded; git initialised.
- Env validation, Mongo client, typed collections, indexes.
- All five entity models (types + DTOs + zod).
- Auth.js Credentials + JWT, register/login/logout, `proxy.ts` route protection,
  `LOCAL_MODE` bypass, session/workspace helpers.
- App shell (sidebar, user menu, theme toggle) + **dashboard reading live data**.
- Login/register pages; placeholder pages for the feature sections.
- `scripts/seed.ts` (demo team, sprints, 12 tasks, wiki).
- Docs: this plan, `README.md`, `CLAUDE.md`.

**Acceptance (met):** `tsc --noEmit` clean; app compiles (webpack); seed populates
Atlas; the auth proxy redirects unauthenticated `/dashboard` → `/login`.

---

### ✅ M1 — Sprint board (swimlane Kanban)
Drag‑and‑drop board — the headline feature.
- Introduced the **Epic → Task** hierarchy; statuses became `new/active/resolved/closed`.
- Board grid: epic rows × status columns. Each `(epic, status)` cell is its own
  droppable, so **empty cells accept drops**.
- Dragging a card **left/right** changes its status; dragging it **up/down into
  another row re‑parents it** to that epic. Both persist through one
  `moveTaskAction`.
- Optimistic UI with a drag‑start snapshot for rollback + an error toast; no‑op
  drops never hit the database.
- Epic rows show a derived status badge + progress bar, recomputed live.
- Inline quick‑add in each row's New cell; `New epic` dialog; sprint switcher
  (`/board?sprint=<id>` or `backlog`); epic delete cascades its tasks.
- Keyboard DnD wired via `KeyboardSensor` + `sortableKeyboardCoordinates`.

**Key files:** `app/(app)/board/page.tsx`, `components/board/*`,
`lib/queries/board.ts`, `lib/board-state.ts`, `lib/actions/{epics,tasks}.ts`.

**Acceptance (met):** typecheck + lint clean; verified in a real browser against
Atlas — dragged a card across columns and re‑parented one into another epic's row,
both persisted (confirmed by querying MongoDB directly) and survived a reload;
quick‑add works; all five rollup branches render correctly; 0 console errors.

Two real bugs were found and fixed during verification:
1. **Hydration mismatch** — `DndContext` needs an explicit `id`, otherwise dnd‑kit
   derives `aria-describedby` from a module counter that differs across SSR.
2. **Fast Refresh loop** — the Playwright MCP writes console logs into
   `.playwright-mcp/` inside the project; the dev watcher rebuilt on every browser
   log. Excluded in `next.config.ts` `watchOptions.ignored`.

---

### ⬜ M2 — Task management & tracking
- Task list view with search + filters (status, priority, assignee, label).
- Task detail (dialog or `/tasks/[id]`): full edit, description, labels, due date,
  reporter, timestamps. Create/update/delete Server Actions (`createTaskSchema`,
  `updateTaskSchema`).
- Empty/loading/error states.

**Acceptance:** create/edit/delete a task; filters + search narrow the list; detail
view round‑trips all fields.

---

### ⬜ M3 — Members & assignments
- Members page: list workspace members with roles.
- Invite by email (add an existing user; or a lightweight pending‑invite record).
- Role management (owner/admin/member) with permission checks in actions.
- Assignee picker on tasks (multi‑select with avatars); assignee filter on board/list.

**Acceptance:** add/remove a member; change a role; assign multiple members to a
task and see avatars on the card; non‑admins can't change roles.

---

### ⬜ M4 — Wiki
- Page tree (nested via `parentId`) in a sidebar.
- Markdown editor with live preview; render with a sanitized markdown renderer.
- Create/edit/delete pages; unique slug per workspace; breadcrumbs.

**Acceptance:** create a nested page; edit markdown and see it rendered; navigate
the tree; delete a page (with children handled).

---

### ⬜ M5 — Settings & profile
- Workspace settings (rename, slug, delete).
- Profile (name, avatar, change password); multi‑workspace switcher (optional).

**Acceptance:** rename workspace reflects in the sidebar; change password then
re‑login works.

---

### ⬜ M6 — Offline / local‑mode polish
- Document + smooth the `LOCAL_MODE=true` path; optional local MongoDB via Docker
  compose for a fully offline setup.
- Optional PWA (installable, offline shell caching).

**Acceptance:** `LOCAL_MODE=true npm run dev` with a local Mongo → full app, no login.

---

### ⬜ M7 — Hardening & deploy
- Auth rate limiting; error boundaries + `loading.tsx`; a11y pass; Lighthouse.
- Playwright E2E (login → create task → move on board) via the configured MCP.
- Deploy to Vercel (steps below); confirm prod build (Turbopack) is green.

**Acceptance:** deployed on Vercel Hobby; E2E green; no console/type errors.

---

## 5. Deployment (Vercel Hobby + Atlas)

1. **Atlas:** use the existing cluster (or create an M0). Add a database user and
   allow Vercel egress (`0.0.0.0/0` for Hobby, or Atlas + Vercel integration).
   Use a dedicated DB name (`todo` for prod, `todo_dev` for local).
2. **Push** the repo to GitHub and import it into Vercel.
3. **Env vars** in Vercel (Production + Preview):
   `MONGODB_URI`, `MONGODB_DB=todo`, `AUTH_SECRET` (generate with `npx auth secret`),
   `LOCAL_MODE=false`.
4. **Deploy** — runs `npm run build` (webpack; see the Turbopack note above).
   `outputFileTracingRoot` is pinned in `next.config.ts` so tracing is scoped.
5. After first deploy, run the seed **against prod only if you want demo data**
   (`MONGODB_DB=todo npm run seed`) — otherwise register real accounts.

---

## 6. Environment variables

| Var | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | yes | Atlas/local connection string |
| `MONGODB_DB` | no (default `todo`) | Logical DB name; use `todo_dev` locally |
| `AUTH_SECRET` | yes (hosted) | Signs the session JWT (`npx auth secret`) |
| `LOCAL_MODE` | no (default false) | `true` disables auth for offline use |

See `.env.example`. `.env.local` is gitignored.

---

## 7. Verification approach
- **Types:** `npm run typecheck` (CI gate).
- **Build:** `npm run build` (webpack) — needs ~1 GB free RAM.
- **Data:** `npm run seed` exercises the full data layer against a real cluster.
- **E2E (M7):** Playwright MCP drives login + board flows; Chrome DevTools MCP for
  perf/console; each milestone is verified by driving the real flow, not just tests.

---

## 8. Risks & notes
- **Auth.js is on a beta (v5).** APIs are stable in practice but pin the version.
- **Credentials + JWT** means no server‑side session revocation list; fine for a
  4‑person tool. Add refresh/rotation only if needed.
- **`order` as a float/int** is simple; if reordering churn grows, switch to a
  fractional‑index (lexo‑rank) strategy — isolated to the board actions.
- **Local dev memory:** a full Next 16 + Tailwind v4 build needs ~2 GB free; on a
  memory‑starved machine the build worker can be OOM‑killed. Vercel is unaffected.
- **Rotate the seeded Atlas credential** that was shared during setup, and create a
  dedicated least‑privilege DB user for the app.
