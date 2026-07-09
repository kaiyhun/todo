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
    tasks.ts               getTasksList() (filtered) + getTaskDetail()
    members.ts             getWorkspaceMembers() — shared by board + tasks
  actions/
    types.ts               ActionResult discriminated unions
    auth.ts                register / login / logout Server Actions
    epics.ts               createEpic / updateEpic (incl. sprint move) / deleteEpic
    tasks.ts               createTask / updateTask / moveTask / deleteTask
  board-types.ts           BoardRow/BoardData + cell-id encode/decode (pure)
  board-state.ts           Pure, immutable drag transitions (findTaskLocation, moveTask)
  task-types.ts            TaskListRow/TaskDetail/TaskFilters/EpicOption (pure)
  session.ts               getCurrentUser / requireUser / getCurrentContext
  workspace.ts             getWorkspaceForUser / createWorkspaceForUser
  navigation.ts format.ts utils.ts

components/
  providers.tsx theme-toggle.tsx coming-soon.tsx
  app-shell/  sidebar.tsx  user-menu.tsx
  board/      board-grid.tsx (DndContext) board-cell.tsx task-card.tsx
              epic-row-header.tsx quick-add-task.tsx sprint-switcher.tsx
              create-epic-dialog.tsx edit-epic-dialog.tsx badges.tsx
  tasks/      tasks-table.tsx task-filters.tsx task-detail-form.tsx task-modal.tsx
  ui/         (shadcn components)

app/
  layout.tsx page.tsx globals.css
  api/auth/[...nextauth]/route.ts
  (auth)/    layout.tsx login/ register/
  (app)/     layout.tsx (renders the `modal` slot) error.tsx
             dashboard/ board/ tasks/ wiki/ members/ settings/
             tasks/[taskId]/page.tsx          full page (direct load / refresh)
             @modal/default.tsx               empty slot
             @modal/[...catchAll]/page.tsx    closes modal on soft nav away
             @modal/(.)tasks/[taskId]/page.tsx  intercepted → dialog

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

### ✅ M2 — Task management & tracking
- **Tasks page**: flat table across every epic (Title · Epic · Status · Priority ·
  Assignees · Due), with search + status/priority/assignee/epic filters. All filter
  state lives in the URL and is applied server-side, so a filtered view is
  shareable and survives a refresh. Search input is debounced; `$regex` input is
  escaped.
- **Task detail is both a modal and a page**, via a parallel `@modal` slot plus an
  intercepting route `(.)tasks/[taskId]`. A soft navigation (from the board or the
  table) opens a dialog over the current page; a direct load / refresh / shared
  link renders the full page at `/tasks/[taskId]`. A catch-all in the slot returns
  `null` so the modal can't linger.
- **Edit**: title, description, epic (re-parent), status, priority, labels, due
  date; delete with confirmation. Changing status/epic re-slots the card at the end
  of its destination cell — the non-drag equivalent of moving it.
- **Epics** gained edit + **move between sprints / backlog** (`updateEpicAction`).
- Board cards open the task detail on click. Drag vs click is disambiguated by
  pointer travel (< 5px = click); `KeyboardSensor` is restricted to Space so Enter
  can open the task.
- `loading.tsx` for /board and /tasks, `error.tsx` for the whole `(app)` segment.

**Key files:** `app/(app)/tasks/*`, `app/(app)/@modal/*`, `components/tasks/*`,
`lib/queries/{tasks,members}.ts`, `lib/task-types.ts`,
`components/board/edit-epic-dialog.tsx`.

**Acceptance (met):** typecheck + lint clean; verified in a real browser against
Atlas with 0 console errors — filters narrow correctly (`?q=.*` returns 0 rows,
proving regex escaping); soft nav renders a modal with the list still mounted
behind it while a hard load renders the full page; edits, status re-slotting, epic
sprint-moves and deletes all persisted (confirmed by querying MongoDB directly);
dragging still works and never navigates.

Two hazards handled explicitly:
1. `updateTaskSchema` is **not** `createTaskSchema.partial()` — the create schema's
   `.default()`s would reset omitted fields.
2. The Mongo driver serialises `undefined` as `null`, so `$set` is built only from
   defined keys. Verified: editing a task's priority leaves its `assigneeIds` (which
   the form never sends) intact.

> Assignee **editing** is intentionally still M3; the table shows and filters by
> assignee already.

---

### ✅ M3 — Members & assignments
- **Members page**: roster with avatars, email, role, joined date. Owner/admins can
  add, promote/demote, remove, and transfer ownership.
- **Adding a teammate is by email, for an account that already exists.** There is
  no mail provider, so nothing is sent: they register at `/register`, then an
  owner/admin adds them. The "already a member" check is enforced atomically in the
  update filter (`members.userId: { $ne }`), not just read-then-write.
- **Permissions are loose** (`lib/permissions.ts`): roles gate *people management*
  only — every member can create, edit, move and delete epics and tasks.
  - owner: everything, and the only one who can transfer ownership
  - admin: manage members, but never the owner
  - member: content only
  - Nobody can act on the owner or on themselves. Ownership moves *only* via an
    explicit transfer, which promotes the new owner and demotes the old one in a
    **single atomic update** (`arrayFilters`) so the workspace never has zero or
    two owners.
- **Removing a member unassigns them everywhere** — one `$pull` across all tasks
  and one across all epics. Their user account and `reporterId` history survive.
- **Assignee picker** (multi-select with avatars, built on `DropdownMenuCheckboxItem`
  — no new dependency) in the task detail form and the epic edit dialog.
- **"Assigned to me"** board toggle (`?mine=1`) **dims** other people's cards rather
  than hiding them. Hiding would make a drag submit an incomplete `orderedIds` for
  its cell (silently reordering other people's cards) and would make each epic's
  rollup describe only a subset of its tasks.
- `requireContext()` now returns the caller's `role`. In LOCAL_MODE it is forced to
  `owner`, since authentication is disabled — the roster may still show the local
  user's stored role, and the page says so.

**Key files:** `lib/permissions.ts`, `lib/actions/members.ts`, `lib/member-types.ts`,
`app/(app)/members/page.tsx`, `components/members/*`,
`components/shared/assignee-picker.tsx`, `components/board/mine-filter-toggle.tsx`.

**Acceptance (met):** typecheck + lint clean; 0 console errors. Verified in a real
browser against Atlas — added a registered non-member by email (and got useful
errors for an unknown email / an existing member); promoted a member to admin;
removed a member and confirmed **5 task + 2 epic assignments were cleared** in the
same operation; transferred ownership and confirmed the promote+demote landed
atomically; assigned two people to a task via the picker; the `?mine=1` toggle dims
to opacity 0.3 while **leaving every card rendered**.

**Permission boundary checked with real logins** (LOCAL_MODE off), not just hidden
buttons — role resolves per user from workspace membership:

| Signed in as | Role | Add form | Action menus | Transfer |
| --- | --- | --- | --- | --- |
| Carol | member | ✗ | 0 | — |
| Bob | admin | ✓ | 3 (not owner, not self) | ✗ |
| Alice | owner | ✓ | 4 | ✓ |

> The seed now makes the **LOCAL_MODE user the workspace owner** (Alice becomes
> admin). Without that, the local user wasn't in the roster at all and every
> people-management action would have been denied once role checks existed.

---

### ✅ M4 — Wiki
- **Page tree** (nested via `parentId`) in the wiki layout, with breadcrumbs on
  each page. `/wiki` lands on the first top-level page.
- **Split-pane editor**: markdown source on the left, live preview on the right.
  The preview renders from a `useDeferredValue` copy so a long document never
  blocks typing.
- **Rendering** via `react-markdown` + `remark-gfm` (tables, task lists,
  strikethrough, autolinks) + `rehype-highlight` for fenced code blocks.
- **The view page ships zero client JS for markdown.** `react-markdown` uses no
  hooks, so it renders inside a Server Component; only the editor's preview pulls
  it into the browser bundle.
- **No XSS surface.** `rehype-raw` is deliberately *not* installed, so raw HTML in
  page content is escaped rather than rendered — there is no
  `dangerouslySetInnerHTML` in this path — and `react-markdown` neutralises
  `javascript:` URLs. Enabling raw HTML later would require an explicit sanitizer
  with an allow-list.
- **Renaming keeps old links alive.** A new title regenerates the slug; the old
  one is retired into `slugAliases[]` (new field + index) and the route serves a
  **308** to the canonical URL. A renamed page's new slug is also stripped from any
  other page's aliases, so the lookup can never be ambiguous.
- **Deleting lifts children** to the deleted page's parent rather than cascading.
- **Cycle-safe re-parenting**: the parent picker omits the page's own subtree, and
  `updateWikiPageAction` re-walks the ancestor chain to reject a cycle anyway.
- Code-block colours are mapped onto our own CSS variables instead of importing a
  highlight.js stylesheet, so they follow the light/dark theme.

- **Inline sidebar search** over `title`, `content`, `slug` and `slugAliases`,
  scoped to the workspace. Matching runs against the **raw markdown** (so a term
  inside a code fence is findable); snippets are built from a markdown-stripped
  copy. The tree is pruned to matching branches, with ancestors kept as dimmed
  context so a nested hit never appears orphaned. Matches are highlighted; a
  slug-only hit is labelled "matched in page URL".
  - A regex scan beats a `$text` index here: `onboard` finds `onboarding`, which
    `$text` would miss (that's a prefix, not a word). User input goes through the
    same `escapeRegex()` the tasks filter uses.
  - Search is **client state calling a Server Action**, not a `?q=` URL param,
    because the tree lives in `wiki/layout.tsx` and **Next.js layouts never receive
    `searchParams`**. Debounced 250 ms, with a stale-response guard.

**Key files:** `lib/models/wiki.ts`, `lib/queries/wiki.ts`, `lib/actions/wiki.ts`,
`lib/wiki-types.ts`, `lib/wiki-search.ts`, `lib/text.ts`, `app/(app)/wiki/*`,
`components/wiki/*`.

**Acceptance (met):** typecheck + lint clean; 0 console errors. Verified in a real
browser against Atlas — GFM table, task-list checkboxes (2 of 3 ticked), code
blocks with highlight tokens and strikethrough all render; **`curl` of the raw HTML
(no JS executed) contains `<table>`, `<pre>` and `hljs-*` classes**, proving the
server render; renaming produced `308 → /wiki/onboarding` with the old slug stored
as an alias; deleting a parent kept its child and promoted it to top level; the
parent picker excluded the page's own child.

**Security probe (attempted, not assumed).** A page containing `<script>`,
`<img onerror>`, `<div onclick>` and `[x](javascript:…)` was saved and rendered:
0 script tags, 0 img tags, 0 `onclick` attributes, the `javascript:` href stripped
to `""`, the raw HTML shown as literal text, and the sentinel `window.__pwned`
still `false` — in both the live preview and the saved page.

Search was verified separately: `onboard` matches `Engineering Onboarding`
(partial word); `sprints` matches on body text; `serializeTask` matches inside a
fenced code block on the nested page and keeps `Team Handbook` as a dimmed
ancestor; a slug hit is labelled; `.*` returns **0 results**; clearing restores the
full tree. `stripMarkdown` originally mangled identifiers (`doc._id` → `doc.id`)
because it blanket-stripped `*` and `_` — it now unwraps *paired* emphasis only,
and underscore emphasis requires a whitespace boundary, as markdown itself does.

> Three hazards worth remembering: `$addToSet` + `$pull` on the same array in one
> update is a Mongo conflict (the alias array is computed in code instead);
> Tailwind Typography paints `pre` from its own CSS variables in a later cascade
> layer, so the override had to be **unlayered** CSS — layer order beats
> specificity; and layouts get no `searchParams`, which is why wiki search can't
> follow the `?q=` pattern used everywhere else.

---

### 🚧 M5 — Settings & profile
Workspace settings **done**; profile still to come.

- **Project timezone** (`workspace.timezone`, IANA). The team's shared clock: every
  instant is stored in UTC and rendered through this zone. Owner + admins can change
  it (`canManageMembers`), via a searchable picker over the runtime's ~418 zones.
- **Two conversions, not one.** The read side formats UTC → project tz. The **write
  side must also convert**, because JS parses the two input formats with opposite
  rules: `new Date("2026-07-20")` is UTC midnight, while
  `new Date("2026-07-20T19:00")` is *server-local*. On Vercel server-local is UTC, so
  a naive write silently stores the wrong instant — and no read-side formatter can
  recover it. It looks correct in local dev whenever the developer sits in the
  project timezone.
- **A due date is the end of that calendar day in the project timezone.** Written by
  `parseDueDate()` in `lib/time-server.ts` — `@js-temporal/polyfill`, behind
  `server-only` so its ~200 KB never reaches the browser. `Temporal` is not in
  Node 22 and `Date.parse` rejects IANA zones, so this cannot be hand-waved.
- All formatters take the zone explicitly (`formatDate(iso, tz)` …). Server
  Components read it from `requireContext()`; Client Components from `useTimezone()`.
  This is also what removed the latent hydration mismatch — an ambient
  `toLocaleDateString(undefined, …)` renders differently on server and browser.

**Key files:** `lib/timezone.ts`, `lib/time-server.ts`, `lib/format.ts`,
`lib/actions/workspace.ts`, `components/providers/timezone-provider.tsx`,
`components/settings/*`, `app/(app)/settings/page.tsx`.

**Acceptance (met):** typecheck + lint clean, 0 hydration errors, 0 console errors.
Verified with the **dev server running as `TZ=UTC` to simulate Vercel**, project tz
`America/Vancouver`:

| Check | Result |
| --- | --- |
| Seeded due date `2026-07-20` | stored `2026-07-21T06:59:59.999Z` = *Jul 20, 11:59:59 PM PDT* |
| Tasks table (Server Component) | `Jul 20, 2026` |
| Date input (Client, SSR + hydrated) | `2026-07-20` |
| Timestamps | `Jul 9, 2026 at 1:14 AM PDT` |
| Round-trip: pick `2026-08-15` in the UI | stored `2026-08-16T06:59:59.999Z` ✅ (old code: `2026-08-15T00:00Z` → renders **Aug 14**) |
| Switch project tz → `Asia/Tokyo` | dates re-render on the new clock (`GMT+9`); the same instant reads as Aug 16 |

Temporal was validated against the nasty zones before building on it: DST
spring-forward and fall-back, `Asia/Kolkata`'s half-hour offset, and
`America/Santiago` on a day when **midnight does not exist**.

**Still to do:** profile (name, avatar, change password); optional multi-workspace
switcher; workspace delete.

> Due dates remain date-only, so changing the project timezone re-reads them on the
> new clock (a far-westward move can show the previous day). That was an explicit
> trade-off against storing a plain `YYYY-MM-DD` string. Timestamps, being true
> instants, are unaffected — they just show a different wall clock.

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
