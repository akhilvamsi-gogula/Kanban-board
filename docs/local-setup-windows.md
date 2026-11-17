# Local setup on Windows without Docker

For a Windows PC without Docker or WSL. Commands are for Git Bash.

## One-time setup

1. Install [Node.js LTS](https://nodejs.org/), [uv](https://docs.astral.sh/uv/) and Postgres 16. The steps below use the Postgres zip archive unpacked to `C:\tools\pg16`; with the installer, Postgres runs as a service and you can skip starting it by hand.
2. Create the database (zip only):

   ```bash
   PG=/c/tools/pg16/pgsql/bin
   "$PG/initdb.exe" -D /c/tools/pg16/data -U postgres -A trust
   "$PG/pg_ctl.exe" -D /c/tools/pg16/data -l /c/tools/pg16/server.log start
   "$PG/psql.exe" -U postgres -c "CREATE ROLE kanban LOGIN PASSWORD 'kanban'"
   "$PG/psql.exe" -U postgres -c "CREATE DATABASE kanban OWNER kanban"
   "$PG/psql.exe" -U postgres -c "CREATE DATABASE kanban_test OWNER kanban"
   ```

3. `cp .env.example .env` in the repository root, and set `GROQ_API_KEY` to use the AI.
4. `cd backend && uv sync`, then `cd frontend && npm install`.

## Every time

1. Start Postgres (zip only, needed after every reboot):

   ```bash
   /c/tools/pg16/pgsql/bin/pg_ctl.exe -D /c/tools/pg16/data -l /c/tools/pg16/server.log start
   ```

2. Terminal 1, from `backend/`: `uv run uvicorn app.main:app --host 127.0.0.1 --port 8000`
3. Terminal 2, from `frontend/`: `npm run dev`
4. Open http://localhost:3000 and sign up.

## Tests

Run them as in the README. If Windows blocks `uv run pytest` ("Application Control policy has blocked this file"), use `uv run python -m pytest -q` from `backend/`.
