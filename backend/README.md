# Backend

The backend is a FastAPI service for board persistence and the optional AI co-pilot. It serves a smoke-test page at `/`, a health response at `/health`, and a JSON hello response at `/api/hello`.

Part 6 adds the user-scoped Kanban API:

- `GET /api/users/{user_id}/board` reads a validated board.
- `PUT /api/users/{user_id}/board` replaces the validated board and persists it atomically.

AI routes:

- `GET /api/ai/check` performs a small Groq connectivity check.
- `POST /api/ai/chat` accepts board context, a prompt, and limited chat history, then returns structured assistant text and an optional board update.

The seeded demo user is `demo-user`. The JSON store is created at `backend/data/kanban.json` by default. Set `KANBAN_DATA_PATH` to use a different local path during development or tests.

## Environment and secrets

From the repository root:

```bash
cp .env.example .env
chmod 600 .env
```

Set `GROQ_API_KEY` in that local file (get a free key at [console.groq.com](https://console.groq.com/keys), no credit card required). Never expose it through a `NEXT_PUBLIC_` variable, source code, tests, logs, or committed files. `/api/ai/*` has no authentication of its own, so it's rate-limited in-app to protect Groq's daily free-tier quota. The default model is `openai/gpt-oss-20b`.

## Direct run

```bash
cd backend
uv sync
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

`uv sync` creates `.venv` and installs pinned dependencies from `uv.lock`.

Open http://127.0.0.1:8000/.

## Tests

```bash
cd backend
uv run pytest
```

## Docker

From the repository root:

```bash
./scripts/start.sh
```

Open http://127.0.0.1:8000/. Stop the service with `./scripts/stop.sh`.

In Codespaces, forward port 8000 to access the page from a browser. If Docker is unavailable, use the direct-run commands above.
