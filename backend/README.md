# Backend

The backend is a FastAPI service for multi-user Kanban board persistence and the optional AI co-pilot. It serves a smoke-test page at `/`, a health response at `/health`, and a JSON hello response at `/api/hello`.

Auth routes: `POST /api/auth/{signup,login,logout,forgot-password,reset-password}`, `GET /api/auth/me`.

Board routes (session-scoped, ownership-checked): `GET /api/boards`, `POST /api/boards`, `GET/PUT/PATCH/DELETE /api/boards/{board_id}`.

AI routes (session required, 10 requests/min per account):

- `GET /api/ai/check` performs a small Groq connectivity check.
- `POST /api/ai/chat` accepts one of your boards, a prompt, and limited chat history, then returns structured assistant text and, if the board should change, the complete updated board.

`GET /api/health` (no database access) is the wake-up probe the frontend polls while Render boots.

Code layout: `app/main.py` (wiring), `app/routers/` (auth, boards, ai), `app/ai_service.py` (prompt, Groq call, reply parsing and merge), `app/rate_limit.py`, `app/deps.py`, `app/repository.py` (Postgres via a connection pool), `app/models.py`. `scripts/load_check.py` runs a concurrent multi-user check against a running backend (`uv run python scripts/load_check.py --users 25`).

Data persists to Postgres, via the connection string in `DATABASE_URL` (required - the app fails to start without it). Locally, `docker compose up -d postgres` (from the repository root) starts one on `localhost:5432`; in production this points at a separate managed Postgres instance (e.g. Neon) so data survives the service redeploying or spinning down. See the root [`CLAUDE.md`](../CLAUDE.md) for the full data model.

## Environment and secrets

From the repository root:

```bash
cp .env.example .env
chmod 600 .env
```

Set `GROQ_API_KEY` in that local file (get a free key at [console.groq.com](https://console.groq.com/keys), no credit card required). Never expose it through a `NEXT_PUBLIC_` variable, source code, tests, logs, or committed files. One key serves every user, so `/api/ai/*` requires sign-in and is rate-limited per account to protect Groq's shared free-tier quota. The default model is `openai/gpt-oss-20b`.

## Direct run

```bash
docker compose up -d postgres --wait   # from the repository root, or point DATABASE_URL at your own Postgres
cd backend
uv sync
DATABASE_URL=postgresql://kanban:kanban@localhost:5432/kanban uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

`uv sync` creates `.venv` and installs pinned dependencies from `uv.lock`.

Open http://127.0.0.1:8000/.

## Tests

Needs the same Postgres instance reachable. Tests default to a separate `kanban_test` database (`postgresql://kanban:kanban@localhost:5432/kanban_test`, created if missing; override with `TEST_DATABASE_URL`) because every test truncates all tables:

```bash
docker compose up -d postgres --wait   # from the repository root
cd backend
uv run pytest -q
```

## Docker

From the repository root:

```bash
./scripts/start.sh
```

This starts both the backend and a `postgres` service. Open http://127.0.0.1:8000/. Stop with `./scripts/stop.sh` (data persists in the `postgres_data` volume across this; `docker compose down -v` also removes the volume for a clean slate).

In Codespaces, forward port 8000 to access the page from a browser. If Docker is unavailable, use the direct-run commands above.
