# Kanban Board

A polished Kanban project-management app with per-user accounts, a private five-column board per account, drag-and-drop cards, and an optional AI co-pilot.

![Kanban board preview](docs/kanban-board-preview.svg)

## What It Does

- Real accounts: sign up, sign in, sign out, and forgot/reset password.
- Gives each account its own private board with five seeded columns.
- Adds, edits, deletes, and reorders cards.
- Moves cards between columns with pointer or keyboard drag-and-drop.
- Renames columns.
- Persists accounts and board changes in a local SQLite store through FastAPI.
- Provides an optional AI co-pilot that can answer board questions and request safe board updates.

Passwords are hashed (bcrypt) and sessions are real server-side sessions (httpOnly cookie), but this is still a local/single-instance app, not a production deployment — there's no real email delivery (password reset returns the reset link directly in the API response/UI instead of emailing it) and the SQLite store is intended for development, not concurrent production use.

## Requirements

- Node.js 20 or later and npm
- Python 3.12 or later
- [uv](https://docs.astral.sh/uv/) for the backend
- Docker Compose, optional but recommended for the backend

## First-Time Setup

From the repository root:

```bash
cp .env.example .env
chmod 600 .env
```

Open `.env` and set `GROQ_API_KEY` if you want to use the AI co-pilot (get a free key at [console.groq.com](https://console.groq.com/keys) — no credit card required). Never put the key in `frontend/.env.local`, a `NEXT_PUBLIC_` variable, source code, tests, screenshots, or commit history. `.env` is ignored by Git.

## Start With Docker

Start the FastAPI backend:

```bash
./scripts/start.sh
```

The backend runs at `http://127.0.0.1:8000`. In a second terminal, start the frontend:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`, or use the forwarded port URL supplied by Codespaces or your remote development environment.

## Start Without Docker

Install backend dependencies and run the API with uv:

```bash
cd backend
uv sync
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

`uv sync` creates `backend/.venv` and installs pinned dependencies from `uv.lock` automatically; there is no separate `pip install` step.

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

If port 8000 is occupied, use another backend port and configure the frontend before starting Next.js:

```bash
cd backend
uv run uvicorn app.main:app --host 127.0.0.1 --port 8001
```

```bash
cd frontend
KANBAN_BACKEND_URL=http://127.0.0.1:8001 npm run dev
```

## Using The App

1. Open the frontend.
2. Create an account (username + password) — this seeds a private board for you.
3. Use the board controls to add, edit, delete, rename, and move cards.
4. Select the visible **AI co-pilot** control to open the assistant workspace.
5. Try `How many cards are there?` or `Rename Backlog to Ideas`.

Sessions persist across refresh (a real server-side session cookie, not client-only state) until you log out or the session expires (7 days). Forgot your password? Use **Forgot password?** on the sign-in screen — since there's no email provider configured, the reset link is shown directly on screen instead of being emailed.

## AI Co-Pilot

The browser never calls Groq directly. Only the FastAPI backend reads `GROQ_API_KEY`.

```env
GROQ_API_KEY=your_local_key
GROQ_MODEL=openai/gpt-oss-20b
GROQ_TIMEOUT_MS=15000
```

Groq hosts OpenAI's open-weight `gpt-oss` models on its own inference hardware with a genuinely free tier (no credit card, no shared-pool congestion like typical free-tier aggregator models). The default model, `openai/gpt-oss-20b`, uses `reasoning_effort: "low"` to keep responses fast. Groq's free tier is still rate-limited (requests/tokens per minute, requests per day); a quota or provider error does not prevent normal Kanban use — close the assistant and continue using the board.

`/api/ai/chat` and `/api/ai/check` have no authentication of their own (a signed-in session isn't required to call them directly); they're rate-limited in-app to 10 requests/minute per client so a caller who bypasses the frontend sign-in can't burn through Groq's daily free quota on its own.

AI requests include the current board and a limited conversation history. The backend caps `max_tokens` per request and validates structured responses before the frontend applies a board update. Do not send passwords, API keys, or unrelated private information in chat prompts.

Ask the assistant to `undo` to revert the most recent board change it made. This is handled entirely on the frontend from a saved snapshot (no request to Groq) — the assistant is never shown prior board states, so it can't reconstruct an earlier layout on its own.

To check provider connectivity:

```bash
curl http://127.0.0.1:8000/api/ai/check
```

This requires a valid local key and consumes provider quota.

## Useful Endpoints

- `GET /health` - backend health check
- `GET /api/hello` - smoke-test response
- `POST /api/auth/signup` - create an account (seeds a private board), sets the session cookie
- `POST /api/auth/login` - sign in, sets the session cookie
- `POST /api/auth/logout` - sign out, clears the session cookie
- `GET /api/auth/me` - current signed-in user, or 401
- `POST /api/auth/forgot-password` - request a password reset (returns the reset token directly, no email)
- `POST /api/auth/reset-password` - complete a password reset with a token
- `GET /api/board` - read the signed-in user's board (requires a session)
- `PUT /api/board` - save the signed-in user's board (requires a session)
- `GET /api/ai/check` - provider connectivity check
- `POST /api/ai/chat` - structured board-aware assistant request

## Validate Changes

Frontend:

```bash
cd frontend
npm run lint
npx tsc --noEmit
npm run test -- --run
npm run build
npm run test:e2e
```

Backend:

```bash
cd backend
uv run pytest -q
```

Playwright requires browser binaries and compatible system libraries. Live AI browser tests also require provider availability and consume quota, so AI behavior is primarily covered with mocked provider tests.

## Troubleshooting

### The frontend shows a backend or rewrite error

Confirm the backend is running:

```bash
curl http://127.0.0.1:8000/health
```

If using port 8001, restart Next.js with `KANBAN_BACKEND_URL=http://127.0.0.1:8001`.

### The AI assistant reports a rate limit or credit error

This is a Groq account or model quota limitation, not a Kanban board failure. Wait for the quota window to reset, or select another available model in `.env`.

### Reset all local accounts and board data

Stop the backend, remove `backend/data/kanban.db` (and any `-wal`/`-shm` files next to it), and start the backend again. All accounts and boards are gone; the schema is recreated empty on next signup.
