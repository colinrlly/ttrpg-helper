# Scriptorium — `ttrpg-helper`

A free, open-source session-prep companion for tabletop RPG dungeon masters.

Draft your session, let the **Scribe** surface what's still missing (foes, loot,
rules, a strong start, scenes, secrets), and arrive at the table ready. The
Scribe proposes; the DM always decides.

## Stack

A Next.js (App Router) web app deployed on Vercel.

- **Next.js + TypeScript** — UI and LLM proxy in one deploy
- **Supabase** — Postgres (`jsonb` sessions) + anonymous auth + RLS, with an
  IndexedDB local-first cache (planned, M1)
- **Vercel AI SDK** behind a provider-agnostic `LlmClient` (planned, M3)

See [`docs/architecture.md`](docs/architecture.md) for the full architecture and
decision log.

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
```

```bash
npm run build      # production build
npm run typecheck  # tsc --noEmit
npm run lint       # next lint
```
