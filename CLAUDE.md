# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

A multi-user Kanban app. Frontend: Next.js (App Router, TypeScript, client-only board) in `frontend/`. Backend: FastAPI in `backend/`, storing everything in Postgres (`DATABASE_URL`). The AI co-pilot calls Groq from the backend only.

Read these before changing the matching area:

- [docs/architecture.md](docs/architecture.md): API, data flow, save queue, AI merge, rate limits
- [docs/testing.md](docs/testing.md): test layers, device profiles, edge cases, load test
- [docs/deployment.md](docs/deployment.md): hosting, environment variables
- [docs/database-schema.md](docs/database-schema.md): tables
- [AGENTS.md](AGENTS.md): product requirements and coding standards
- [docs/PLAN.md](docs/PLAN.md): build log; add a Part with a checklist and validation record for new work

`frontend/AGENTS.md` is written by `next dev`. Don't hand-edit it; commit it if it shows up in a diff.

## Commands

Backend dependencies use [uv](https://docs.astral.sh/uv/) (`uv add <package>`; never hand-edit `uv.lock`).

```bash
./scripts/start.sh                    # backend + Postgres via Docker Compose (./scripts/stop.sh to stop)

cd backend                            # or without Docker, against any Postgres:
uv sync
DATABASE_URL=postgresql://kanban:kanban@localhost:5432/kanban uv run uvicorn app.main:app --host 127.0.0.1 --port 8000

cd frontend
npm install
npm run dev                           # http://localhost:3000, proxies /backend-api/* to the backend
```

Validation, all of it before calling work done:

```bash
cd backend && uv run pytest -q        # needs Postgres on localhost:5432
cd frontend
npm run lint
npx tsc --noEmit
npm run test -- --run
npm run build
npm run test:e2e                      # Playwright: desktop, iphone-13, pixel-7, galaxy-s24-ultra
```

Single tests: `uv run pytest -q tests/test_main.py::test_name`, `npm run test -- --run tests/board.test.tsx`, `npx playwright test --project=galaxy-s24-ultra`.

After changing the AI system prompt, `GROQ_MODEL` or board-update merging, also run `uv run python eval/ai_eval.py` from `backend/` (uses Groq quota). After changing the repository or pool, run `uv run python scripts/load_check.py --users 25`.

## Things that will bite you

- **Backend tests empty every table before each test.** They use `TEST_DATABASE_URL`, defaulting to a separate `kanban_test` database. Never point it at a database you care about.
- **E2E needs a raised auth limit.** Every test signs up from 127.0.0.1. Playwright sets `KANBAN_AUTH_RATE_LIMIT=1000` on a backend it starts; a backend you started yourself needs it too.
- **`GROQ_API_KEY` stays backend-only.** Never in `frontend/.env.local`, a `NEXT_PUBLIC_` variable, source, tests, logs or commits.
- **A save replaces the whole board.** The frontend always PUTs the complete board; `page.tsx` sends one save at a time and keeps only the newest. Don't add a second code path that saves.
- **Array order vs position.** The frontend's card and column order is array order; the API and database use explicit `position`. Convert with `toColumns` / `toApiColumns` in `lib/api.ts`.
- **Column and card ids are unique per board, not globally.**
- **Limits live in `backend/app/models.py`.** The matching `maxLength` on frontend inputs must be changed with them.
- **Touch drag depends on `touch-action: none` on `.drag-handle`** and the separate mouse and touch sensors in `components/board.tsx`.
- **`GET /api/health` must not touch the database.** The wake-up screen polls it while the backend boots.
- **No migration tool.** The schema is `CREATE TABLE IF NOT EXISTS`; changing an existing table needs a manual change on the live database.

## Conventions

- Keep it simple: no over-engineering, no defensive code for cases that can't happen, no speculative features. Fixed five columns, cards have a title and details, no search, archive or filter.
- No emojis, anywhere.
- Dark, board-first UI. No hero copy or unrelated navigation. The product name is "Kanban board".
- Don't add real email, OAuth or production hardening unless asked.
- Keep this file short. The README explains the app and its testing for a new reader; reference detail goes in `docs/`. When a test count or device profile changes, update the README and `docs/testing.md`.
