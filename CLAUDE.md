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
- **Next.js 16**: middleware is `proxy.ts`; `cookies`/`headers`/`params`/
  `searchParams` are async — always `await`.
- **UI**: add shadcn components via the shadcn MCP / CLI; icons from `lucide-react`.

## Commands
`npm run dev` · `npm run build` · `npm run typecheck` · `npm run seed`

## Gotchas
- shadcn CLI: `init` needs a preset (`-p nova`) and base (`-b radix`).
- A full build needs ~2 GB free RAM.
- `.env.local` is gitignored; use `.env.example` as the template.
