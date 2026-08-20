# Backend

The Part 2 backend is a minimal FastAPI service. It serves a smoke-test page at `/`, a health response at `/health`, and a JSON hello response at `/api/hello`.

Part 6 adds the user-scoped Kanban API:

- `GET /api/users/{user_id}/board` reads a validated board.
- `PUT /api/users/{user_id}/board` replaces the validated board and persists it atomically.

The seeded demo user is `demo-user`. The JSON store is created at `backend/data/kanban.json` by default. Set `KANBAN_DATA_PATH` to use a different local path during development or tests.

## Direct run

```bash
cd backend
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Open http://127.0.0.1:8000/.

## Tests

```bash
cd backend
.venv/bin/python -m pytest
```

## Docker

From the repository root:

```bash
./scripts/start.sh
```

Open http://127.0.0.1:8000/. Stop the service with `./scripts/stop.sh`.

In Codespaces, forward port 8000 to access the page from a browser. If Docker is unavailable, use the direct-run commands above.
