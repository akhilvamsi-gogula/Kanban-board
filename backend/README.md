# Backend

The Part 2 backend is a minimal FastAPI service. It serves a smoke-test page at `/`, a health response at `/health`, and a JSON hello response at `/api/hello`.

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
