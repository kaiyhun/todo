@AGENTS.md

# Sprintboard — project guide

Sprint board + task tracking + team wiki for a small team. Next.js 16 (App
Router, TS), MongoDB, Auth.js (Credentials + JWT), Tailwind v4 + shadcn/ui.
Deploys on Vercel Hobby. Full plan: `IMPLEMENTATION_PLAN.md`.

## Conventions
- **Verify library APIs with the context7 MCP** before using them (this repo is
  on Next.js **16** and Auth.js **v5** — both differ from older docs).
- **Models** (`src/lib/models/*`): each entity has a `*Doc` (Mongo shape), a plain
  `*` DTO, a `serializeX()` mapper, and zod schemas. Never pass `ObjectId`/`Date`
  to Client Components — serialize first.
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
