# Deployment and configuration

## Where it runs

| Part | Host | Notes |
|---|---|---|
| Frontend | Vercel | Next.js; rewrites `/backend-api/*` to the backend |
| Backend | Render, free web service, Docker (`backend/Dockerfile`) | one instance |
| Database | Neon, free Postgres project | separate from the backend, so data survives redeploys |

Live app: https://kanban-board-seven-lilac.vercel.app/

## Environment variables

Backend (Render, or the repository-root `.env` locally; see `.env.example`):

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | yes | none | Postgres connection string. The app does not start without it. |
| `GROQ_API_KEY` | for the AI | none | Without it the AI routes return 503; everything else works. |
| `GROQ_MODEL` | no | `openai/gpt-oss-20b` | Chat model, sent with `reasoning_effort: "medium"` (the connectivity check uses `"low"`). |
| `GROQ_TIMEOUT_MS` | no | `15000` | Overall deadline for one Groq request. |
| `GROQ_VISION_MODEL` | no | `qwen/qwen3.8-27b` | Reads attached images. A Groq preview model, so it may be retired; set it to another vision model then, or to an empty value to turn image reading off. Documents keep working either way. |
| `AI_ATTACHMENT_MAX_CHARS` | no | `10000` | Attachment text sent with one AI message, shared between its files. Raise it on a paid Groq plan. |
| `KANBAN_CORS_ORIGINS` | no | `http://localhost:3000,http://127.0.0.1:3000` | Only matters if a browser calls the backend directly instead of through the frontend's rewrite. |
| `KANBAN_AUTH_RATE_LIMIT` | no | `20` | Auth requests per minute per IP. Raise it for the e2e suite and the load check. |
| `RENDER` | set by Render | none | When present, the session cookie is marked `Secure`. |

Frontend (Vercel):

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `KANBAN_BACKEND_URL` | in production | `http://127.0.0.1:8000` | Where `/backend-api/*` is rewritten to. |

`GROQ_API_KEY` must stay backend-only. Never put it in `frontend/.env.local`, a `NEXT_PUBLIC_` variable, source, tests, logs or commit history.

Locally, `docker-compose.yml` passes the root `.env` into the backend container through `env_file`. The container has no `.env` file of its own, so if the key is not reaching it, check that wiring first.

## Database

- Render's free tier has no persistent disk, and the service's filesystem resets on every redeploy and spin-down. The database therefore lives on Neon.
- Use Neon's **pooled** connection string (the host contains `-pooler`) for `DATABASE_URL` in production. It handles many short connections better than the direct one.
- Neon's free tier scales to zero after 5 idle minutes and wakes on the next query in a few hundred milliseconds. The backend checks each pooled connection before using it, so a dropped connection is replaced instead of causing an error.
- The schema is created on start-up with `CREATE TABLE IF NOT EXISTS`. There is no migration tool. See [database-schema.md](database-schema.md).

## Cold start

Render's free tier stops the backend after 15 minutes without traffic. The next request waits about 30-50 seconds while it boots. The frontend pings `GET /api/health` as soon as the page opens, which starts the wake-up, and shows a "Waking up the server" screen if that takes more than 2 seconds. There is no keep-alive job.

The Docker image starts with `uv run --no-sync`, which skips the dependency check on every boot.

## Limits to know about

- **AI quota.** One Groq key serves every user: 8,000 tokens per minute and 1,000 requests per day on the free tier. Several people using the AI in the same minute will see "The AI is busy right now". Each account is also limited to 10 AI requests per minute.
- **Attachments.** 4 MB per file, because Vercel caps request bodies at 4.5 MB and uploads pass through its rewrite. Photos straight from a phone camera are often larger and are refused. Each image costs a vision request against the same Groq quota.
- **Single instance.** Rate limits are kept in memory, so they reset on restart and would not be shared between instances. Sessions are in Postgres and are not affected.
- **No email.** Password reset shows the reset link on screen instead of emailing it.
- **Not production-hardened.** No HTTPS enforcement in the app, no secret rotation, no OAuth. This is a deliberately small project.

## Local run

See the [README](../README.md) for the quick start, or [local-setup-windows.md](local-setup-windows.md) on Windows. Without Docker, any Postgres 16 reachable through `DATABASE_URL` works:

```bash
cd backend
uv sync
DATABASE_URL=postgresql://kanban:kanban@localhost:5432/kanban uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

If port 8000 is taken, run uvicorn on another port and start the frontend with `KANBAN_BACKEND_URL=http://127.0.0.1:8001 npm run dev`.

To reset all local data, stop the backend and drop and recreate the database (with Docker Compose: `docker compose down -v`, then `./scripts/start.sh`). The schema is recreated empty on the next start.
