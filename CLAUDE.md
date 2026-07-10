@AGENTS.md

# Sprintboard — project guide

Sprint board + task tracking + team wiki for a small team. Next.js 16 (App
Router, TS), MongoDB, Auth.js (Credentials + JWT), Tailwind v4 + shadcn/ui.
Deploys on Vercel Hobby. Full plan: `IMPLEMENTATION_PLAN.md`.

## Domain model
- **Epic → Task.** An epic is a *board row*; the tasks it owns are the *cards*
  that move across the columns `new · active · resolved · closed`. Every task has
  a required `epicId`; tasks inherit their sprint from the epic.
- An epic has **no stored status** — it's derived by `rollupEpicStatus()` in
  `src/lib/models/epic-progress.ts`. Don't add a `status` field to epics.
- Dragging a card sideways changes `status`; dragging it into another row changes
  `epicId`. Both go through `moveTaskAction`, which rewrites the destination
  cell's `order` from the client-supplied ordered id list.

## Conventions
- **Verify library APIs with the context7 MCP** before using them (this repo is
  on Next.js **16** and Auth.js **v5** — both differ from older docs).
- **Models** (`src/lib/models/*`): each entity has a `*Doc` (Mongo shape), a plain
  `*` DTO, a `serializeX()` mapper, and zod schemas. Never pass `ObjectId`/`Date`
  to Client Components — serialize first.
- **Client-safe modules**: `models/enums.ts`, `models/epic-progress.ts`,
  `board-types.ts` and `task-types.ts` have no runtime imports on purpose. Import
  shared constants/types from those in Client Components — never from
  `models/index.ts` (pulls in zod + the Mongo driver).
- **dnd-kit**: `DndContext` must have an explicit `id` or SSR hydration breaks.
- **Update schemas are written out by hand**, never `createX.partial()` — the
  create schema's `.default()`s would silently reset omitted fields.
- **Never spread a patch straight into `$set`.** The Mongo driver serialises
  `undefined` as `null`, blanking fields the user never touched. Build `$set` from
  defined keys only (see `updateTaskAction`).
- **Task detail** is one form rendered by two routes: `tasks/[taskId]` (full page)
  and the intercepting `@modal/(.)tasks/[taskId]` (dialog). Keep them in sync.
- Filters/views live in the **URL** (`?sprint=`, `?q=`, `?status=`…) and are applied
  server-side. Escape any user string before putting it in a `$regex`.

## Wiki
- Markdown renders via `components/wiki/markdown.tsx` — **no `"use client"`**, so
  the view page renders it server-side and ships no JS for it.
- **Never add `rehype-raw`.** Raw HTML is escaped today, which is what keeps this
  path free of XSS. Enabling it requires `rehype-sanitize` with an allow-list.
- Renaming a page retires its old slug into `slugAliases[]`; `getWikiPageBySlug`
  matches either and the route 308s to the canonical URL. Keep aliases unambiguous:
  a page's canonical slug must never remain in another page's aliases.
- Deleting a page **lifts its children** to the deleted page's parent.
- Tailwind Typography styles live in a later cascade layer, so `prose` overrides in
  `globals.css` are intentionally **unlayered** — layer order beats specificity.
- Sidebar search is client state + a Server Action, **not** a `?q=` param: the tree
  is rendered by `wiki/layout.tsx` and Next.js layouts get no `searchParams`.
  Matching runs on raw markdown; snippets use `stripMarkdown()` from `lib/text.ts`.
  Always escape user input with `escapeRegex()` before a `$regex`.

## Dates & timezones
- Every instant is stored in **UTC**; every date is rendered through
  `workspace.timezone` (the project's shared clock). Never read the ambient zone:
  `toLocaleDateString(undefined, …)` differs between server and browser and is a
  hydration mismatch.
- `formatDate(iso, tz)` / `formatDateTime(iso, tz)` / `toDateInputValue(iso, tz)` all
  take the zone explicitly. Server Components get it from `requireContext()`;
  Client Components from `useTimezone()`.
- **A due date is written through `parseDueDate(value, workspace.timezone)`** in
  `lib/time-server.ts` (Temporal, `server-only`). Never `new Date(value)`:
  `new Date("2026-07-20")` parses as UTC midnight, and
  `new Date("2026-07-20T19:00")` parses as *server-local* — opposite rules, and on
  Vercel server-local is UTC. The bug is invisible in local dev whenever your
  machine sits in the project timezone.
- A due date means the **end of that day in the project timezone**, so "overdue" is
  a plain instant comparison.
- Anything derived from `new Date()` inside a Client Component (relative times,
  "current time in zone") must be computed on the server and passed as a prop.
- `<body>` has `suppressHydrationWarning` because browser extensions (Grammarly,
  password managers) inject attributes before React hydrates. It only covers that
  element's own attributes — a mismatch anywhere else is a real bug.

## Permissions
- **Loose model** (`src/lib/permissions.ts`): roles gate *people management* only.
  Every member can create/edit/move/delete epics and tasks. Don't add role checks
  to content actions.
- `requireContext()` returns `{ user, workspace, role }`. In **LOCAL_MODE the role
  is forced to `owner`** (auth is off) regardless of the stored membership.
- Nobody may act on the owner or on themselves; ownership moves only via
  `transferOwnershipAction` (atomic `arrayFilters` promote+demote).
- Client components hide controls with the same predicates, but **the Server Action
  is the boundary** — always re-check there.
- The board's `?mine=1` filter **dims** cards; never remove them, or a drag will
  submit an incomplete `orderedIds` for its cell.
- **DB access** goes through typed accessors in `src/lib/db/collections.ts`.
- **Auth is split**: `src/auth.config.ts` is edge‑safe (used by `src/proxy.ts`,
  no DB); `src/auth.ts` adds the Credentials provider (Node runtime only). Don't
  import Node‑only modules (mongo, bcrypt) into `auth.config.ts`/`proxy.ts`.
- **Current user/workspace**: use `getCurrentUser` / `requireContext` from
  `src/lib/session.ts` — they transparently honor `LOCAL_MODE`.
- **Active workspace** (a user may belong to several): `getCurrentContext` picks the
  one named by the `active_workspace` **cookie** (while they're still a member), else
  one they **own** (never silently land someone on a board they were merely added to),
  else the first. The sidebar `WorkspaceSwitcher` is a dropdown outside LOCAL_MODE
  (even with one workspace, since it hosts "Create"); LOCAL_MODE shows a plain header.
  - `switchWorkspaceAction` sets the cookie. `createWorkspaceAction` makes a new
    owned workspace and switches to it, **capped at `MAX_WORKSPACES_PER_USER` (3)
    workspaces you _own_** — enforced server-side via `countOwnedWorkspaces` (the
    client disable is only a courtesy; being *added* to others' boards is uncapped).
  - **Leaving** is self-service via `leaveWorkspaceAction` — the owner can't leave
    (transfer first); leaving unassigns you from that workspace's tasks/epics and
    clears the cookie.
- **Profile is self-service** (`lib/actions/profile.ts`): a user edits their *own*
  name/password with no role check — identity comes from the session, never client
  input. Two traps: (1) outside LOCAL_MODE the display name is read from the **JWT**,
  not the DB, so `updateProfileAction` must `unstable_update({ user: { name } })` and
  `auth.config.ts`'s `jwt` callback merges it on `trigger === "update"`, else the
  sidebar shows a stale name until re-login. In LOCAL_MODE the name comes straight
  from the DB — no token to refresh. (2) **Change-password is disabled in LOCAL_MODE**
  (the local user has no password); the action rejects it and the form hides.
- **Next.js 16**: middleware is `proxy.ts`; `cookies`/`headers`/`params`/
  `searchParams` are async — always `await`.
- **UI**: add shadcn components via the shadcn MCP / CLI; icons from `lucide-react`.

## Commands
`npm run dev` · `npm run build` · `npm run typecheck` · `npm run seed`

## Gotchas
- shadcn CLI: `init` needs a preset (`-p nova`) and base (`-b radix`).
- A full build needs ~2 GB free RAM.
- `.env.local` is gitignored; use `.env.example` as the template.
