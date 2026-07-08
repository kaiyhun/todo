# Sprintboard

A sprint board, task tracker, and team wiki for small teams — with an offline
**local mode** that runs without login. Next.js 16 (App Router) · TypeScript ·
MongoDB · Auth.js · Tailwind + shadcn/ui. Deploys on the Vercel Hobby tier.

See **[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)** for the architecture,
data model, and milestone roadmap.

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
#   then edit .env.local:
#   - MONGODB_URI   your Atlas or local MongoDB connection string
#   - AUTH_SECRET   generate with:  npx auth secret
#   - MONGODB_DB    e.g. todo_dev

# 3. (Optional) load demo data — creates a demo team, sprints, tasks and wiki
npm run seed

# 4. Run
npm run dev            # http://localhost:3000
```

After seeding, log in with any demo account (password `password123`):
`alice@demo.test` (owner), `bob@demo.test`, `carol@demo.test`, `dave@demo.test`.

### Run offline / without login

Set `LOCAL_MODE=true` in `.env.local`. Authentication is disabled and the app
runs as a single local user — ideal for self‑hosting or trying it out locally.
Point `MONGODB_URI` at a local MongoDB (or your Atlas cluster).

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (Turbopack) |
| `npm run start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run seed` | Populate the database with demo data |

## Deployment

Import the repo into Vercel and set `MONGODB_URI`, `MONGODB_DB`, `AUTH_SECRET`,
and `LOCAL_MODE=false`. See the Deployment section of the implementation plan.

## Notes

- `.env.local` is gitignored — never commit secrets. `.env.example` is the template.
- A full local build needs ~2 GB free RAM; low‑memory machines may OOM‑kill the
  build worker (Vercel is unaffected).
