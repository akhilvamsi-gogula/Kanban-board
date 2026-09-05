# Kanban Project Plan

## Direction and Scope

The first deliverable is a simple, client-only Kanban MVP. It has one board, five fixed columns, seeded dummy data, and in-memory state. A browser refresh resets the board. No authentication, persistence, backend, search, filtering, archive, or AI features belong in the MVP.

This document is the working record of scope, decisions, implementation checks, and acceptance criteria. All parts are included in the project roadmap and will be executed in order. The MVP is the first usable release, while the later parts extend it into a persistent, authenticated, AI-assisted application. A phase must meet its success criteria before the next phase begins. Approval checkpoints are required for architectural, data, and external-service decisions, but no planned part is omitted.

## Part 1: Plan and MVP Alignment

### Checklist

- [x] Record the MVP business requirements and explicit non-goals.
- [x] Divide the longer-term work into independently reviewable phases.
- [x] Document tests and success criteria for every phase.
- [x] Verify that `frontend/AGENTS.md` describes the existing Next.js code and local constraints.
- [x] User reviews and approves this plan.
- [x] Confirm that implementation begins with the simple in-memory MVP.

### Tests and checks

- [x] Compare this plan with the repository guidance in the root `AGENTS.md` and the existing README.
- [x] Inspect the current MVP test suite and run the documented validation commands before making follow-up changes.

### Part 1 validation record

- [x] `npm run lint` passes.
- [x] `npx tsc --noEmit` passes.
- [x] `npm run test -- --run` passes: 1 file and 4 tests.
- [x] `npm run build` passes and produces a static `/` route.
- [x] `npm run test:e2e` passes: 4 desktop and mobile tests.
- [x] Fixed E2E-only selector ambiguity for the toolbar add-card action, modal submission, and card deletion; no application behavior changes were required.

### Success criteria

- The MVP scope is unambiguous and is implemented before the later extensions.
- Every project part has a bounded deliverable, tests, and acceptance criteria.
- The user has approved this plan and implementation can proceed with Part 2 after the MVP is validated.

## Part 2: Docker and Backend Scaffolding

This phase follows the validated MVP and establishes the local service boundary. Docker is part of the planned development workflow, not a prerequisite for running the frontend-only MVP.

### Checklist

- [x] Add a root or service-level Dockerfile and `docker-compose.yml`/Compose configuration for the planned services.
- [x] Define Docker, FastAPI, dependency, environment-variable, volume, and network conventions.
- [x] Confirm the Codespaces Docker runtime and document a non-Docker fallback for frontend-only development.
- [x] Add a minimal FastAPI health or hello-world endpoint.
- [x] Add start and stop scripts under `scripts/` for the supported environment.
- [x] Add a small example request from the static test page to the API.
- [x] Document how to start, stop, and troubleshoot the services.

### Docker in GitHub Codespaces

Docker can generally be used in Codespaces, but installing the Docker CLI alone is not sufficient: a Docker daemon must also be available. The preferred implementation is to use the Codespace's supported Docker or Docker-in-Docker setup and verify it with `docker version` and `docker compose version` before relying on Compose.

Known limitations to account for in this plan:

- [x] The Codespace may not have a running daemon, or the user may not have permission to access its socket.
- [x] Docker-in-Docker may require privileged container support, which can be restricted by organization policy or the selected Codespaces configuration.
- [x] Nested containers consume Codespaces CPU, memory, disk, and network quota; builds and Playwright runs may need resource tuning.
- [x] Published ports must use Codespaces port forwarding, and service-to-service hostnames differ between the host and Compose network.
- [x] Docker data and named volumes are not a substitute for durable production storage; Codespace recreation can remove local state.
- [x] Secrets must be supplied through Codespaces secrets or environment configuration and must not be baked into images, logs, or Compose files.
- [x] If Docker is unavailable, the FastAPI service must remain runnable directly with the documented Python command so development is not blocked.

### Tests and success criteria

- [x] Backend unit test verifies the hello-world or health response.
- [x] A local integration check verifies the static page can call the API.
- [x] Start and stop scripts work without exposing secrets or requiring interactive input.
- [x] Existing frontend tests and the MVP user experience remain unchanged.
- [x] Docker and non-Docker startup paths both have documented validation steps.

### Part 2 validation record

- [x] Backend unit tests pass: 3 tests.
- [x] Direct Uvicorn startup serves `/`, `/health`, and `/api/hello`.
- [x] Docker Compose builds the backend image and reports the container healthy.
- [x] `scripts/start.sh` waits for readiness and `scripts/stop.sh` removes the service cleanly.
- [x] Frontend lint, TypeScript, unit tests, and production build pass after backend scaffolding.

## Part 3: Frontend MVP

The current MVP implementation is the target for this phase. Any changes require preserving the requirements below.

### Checklist

- [x] Confirm the Next.js App Router frontend starts from `frontend/`.
- [x] Display the `Kanban board` identity and one board at `/`.
- [x] Render exactly five columns with seeded dummy cards.
- [x] Allow columns to be renamed through their column action.
- [x] Allow cards to be added, edited, and deleted with deletion confirmation.
- [x] Support pointer and keyboard drag-and-drop between columns.
- [x] Support reordering cards within a column.
- [x] Keep state local and reset it on refresh.
- [x] Keep the interface responsive and accessible without adding unrelated navigation or features.

### Tests and success criteria

- [x] Unit/component tests cover rendering, card CRUD, delete confirmation, column renaming, and reordering.
- [x] Keyboard interaction tests cover the drag-and-drop path or its supported equivalent.
- [x] Playwright tests cover the core workflow at desktop and mobile widths.
- [x] Lint, TypeScript, unit tests, production build, and end-to-end tests pass.
- [x] The board is usable at narrow widths and no required content is clipped or overlapped.

### Part 3 validation record

- [x] Vitest passes: 1 file and 6 tests, including CRUD, column renaming, accessible keyboard drag handles, and reorder logic.
- [x] Playwright passes: 4 desktop and mobile workflow tests.
- [x] ESLint, TypeScript, and Next.js production build pass with static `/` output.
- [x] The implementation remains client-only and refresh resets the seeded in-memory board.

## Part 4: Fake Sign-In Experience

This phase changes the first-load experience after the MVP and is explicitly a demo gate, not security.

### Checklist

- [x] Agree that dummy credentials are acceptable and document the limitation.
- [x] Show a sign-in screen before the board.
- [x] Accept only username `user` and password `password`.
- [x] Show an understandable validation error for invalid credentials.
- [x] Allow a signed-in user to log out and return to the sign-in screen.
- [x] Define session behavior: logout/login preserves in-memory board changes, while refresh resets the demo session and board.

### Tests and success criteria

- [x] Component tests cover valid, invalid, empty, and logout flows.
- [x] Browser tests verify the board is inaccessible through the normal UI before sign-in.
- [x] The demo limitation is documented and no real authentication claims are made.

### Part 4 validation record

- [x] Sign-in is client-only React state; refresh resets the session to signed out.
- [x] Board state remains mounted but hidden during logout, so card moves, edits, additions, deletions, and column renames survive logout/login without being persisted across refresh.
- [x] The accepted demo credentials are `user` / `password`; no credentials are persisted or sent to a server.
- [x] Vitest passes: 3 files and 10 tests, including credential behavior and logout/login board-state preservation.
- [x] Playwright passes: 6 desktop and mobile tests, including pre-login protection, login, logout, CRUD, and responsive behavior.
- [x] TypeScript, ESLint, and production build pass.

## Part 5: JSON Database Model

This phase defines the persistence contract before persistence or API implementation. The schema must be reviewed and approved at its checkpoint.

### Checklist

- [x] Define user, board, column, and card identifiers and relationships.
- [x] Define ordering, rename behavior, validation rules, and empty-state behavior.
- [x] Define the JSON file location, initialization behavior, and write strategy.
- [x] Define concurrency, corruption recovery, and backup expectations for local development.
- [x] Document the proposed schema and migration/versioning approach in `docs/`.
- [x] Get user sign-off on the schema before implementation.

### Tests and success criteria

- [x] Schema examples validate for the seeded five-column data shape; empty and multiple-user cases are specified in the design.
- [x] Invalid identifiers, duplicate ordering values, and malformed JSON have defined outcomes.
- [x] The approved document is sufficient to implement the backend without guessing.

### Part 5 validation record

- [x] Added [database-schema.md](database-schema.md) with the proposal and review decisions.
- [x] Added [kanban-database.schema.json](kanban-database.schema.json) as the machine-readable contract.
- [x] Added [kanban-database.example.json](kanban-database.example.json) as the seeded instance.
- [x] Both JSON documents parse successfully; the example has exactly five ordered columns and unique card IDs.
- [x] User approved the schema and Part 6 persistence/API implementation proceeded.

## Part 6: Backend Kanban API

This phase follows the approved Part 5 schema.

### Checklist

- [x] Create the JSON database if it does not exist.
- [x] Implement read and update routes scoped to a user.
- [x] Validate request bodies and preserve the five-column MVP rules.
- [x] Return consistent errors for missing users, boards, columns, and cards.
- [x] Keep file access behind a small repository/service boundary.
- [x] Document the API contract and local configuration.

### Tests and success criteria

- [x] Backend unit tests cover initialization, reads, writes, validation, ordering, and malformed storage.
- [x] API tests cover success and error responses, including user isolation.
- [x] Tests run against an isolated temporary database and do not mutate development data.
- [x] The API contract is documented and repeatable locally.

### Part 6 validation record

- [x] Backend suite passes: 8 tests covering initialization, reads, writes, validation, ordering, unknown users, malformed JSON, and invalid structure.
- [x] Docker Compose builds a healthy backend and `GET /api/users/demo-user/board` returns the seeded five-column board.
- [x] JSON writes are atomic and runtime data is ignored under `backend/data/`.
- [x] Frontend regression suite passes: 10 unit tests, 6 browser tests, TypeScript, ESLint, and production build.

## Part 7: Persistent Frontend and Backend

This phase follows the tested Part 6 API.

### Checklist

- [x] Replace local board reads and writes with API calls behind a typed client.
- [x] Define loading, save failure, retry, and stale-data behavior.
- [x] Preserve optimistic interaction only where rollback behavior is clear.
- [x] Keep the existing board workflows and responsive UI intact.
- [x] Document the required frontend and backend startup order.

### Tests and success criteria

- [x] Component tests cover loading, successful saves, failures, retries, and rollback.
- [x] Integration tests cover CRUD, renaming, and drag ordering through the API.
- [x] Playwright tests verify persistence across reloads and useful error states.
- [x] The frontend never silently loses a confirmed server-side update.

### Part 7 validation record

- [x] Added typed API client and same-origin Next.js proxy for Codespaces/local development.
- [x] Default browser API calls use `/backend-api`; Next.js rewrites that path to local FastAPI `/api` routes. `NEXT_PUBLIC_API_BASE_URL` remains available for a separately hosted API.
- [x] Board reads from the backend after sign-in and saves mutations with optimistic rollback/retry behavior.
- [x] Loading, backend-load failure, save failure, and retry states are visible in the frontend.
- [x] Backend tests pass: 8 tests.
- [x] Frontend tests pass: 12 unit tests, 6 desktop/mobile browser tests, TypeScript, ESLint, and production build.
- [x] Persistent browser workflow confirms a column rename survives reload and sign-in.
- [x] Startup order documented: run `./scripts/start.sh`, then `cd frontend && npm run dev`.

## Part 8: OpenRouter Connectivity

**Superseded:** the AI provider was later migrated from OpenRouter to Groq (`api.groq.com`, OpenAI-compatible) for reliability - Groq's free tier runs on dedicated hardware rather than a shared/oversubscribed pool, which also avoided OpenRouter account billing complexity. `GROQ_API_KEY`/`GROQ_MODEL`/`GROQ_TIMEOUT_MS` replace the `OPENROUTER_*` variables below; the default model became `openai/gpt-oss-20b` served directly by Groq rather than `openai/gpt-oss-20b:free` via OpenRouter. The design decisions recorded below (optional provider, backend-only credentials, 15s timeout, no automatic retry) carried over unchanged to the Groq integration. See `CLAUDE.md` for the current provider configuration.

This phase requires an explicit checkpoint for credentials, cost controls, privacy, and network access before a live provider call.

### Checklist

- [x] Approve OpenRouter as the provider and select `openai/gpt-oss-20b:free` as the default model.
- [x] Define `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, and `OPENROUTER_TIMEOUT_MS`; keys never reach the browser or repository.
- [x] Define a 15-second timeout, no automatic retry, explicit provider/rate-limit errors, and readable frontend error messages.
- [x] Add a backend-only connectivity check using a simple `2+2` prompt.
- [x] Document local `.env` setup and confirm `.env` is ignored by Git.

### Tests and success criteria

- [x] Unit tests mock the provider and cover success, timeout, malformed response, and provider errors.
- [x] A manually authorized connectivity check confirmed a valid response from OpenRouter before the free-model rate limit was reached.
- [x] No test or log exposes the API key.

### Part 8 decisions

- OpenRouter is optional. The board remains usable when the key is missing, the provider is unavailable, or free-model credits/rate limits are exhausted.
- Provider credentials stay in the backend environment only. Do not use `NEXT_PUBLIC_` for secrets.
- OpenRouter free-model usage is subject to provider quotas and may require credits or a different model for continued use.

## Part 9: Structured Board-Aware AI

This phase follows the working provider integration and approved privacy and persistence decisions.

### Checklist

- [x] Define the chat request containing the current board JSON, user question, and conversation history.
- [x] Define the structured response containing `assistant_message` and an optional `board_update`.
- [x] Limit the assistant to board-aware operations; authentication, arbitrary API calls, persistence outside the board API, and unrelated features remain impossible.
- [x] Validate response shape and board-update fields server-side before returning an update to the browser.
- [x] Limit history to the latest eight messages and prompts to 2,000 characters; reject malformed updates clearly.
- [x] Document privacy, retention, and cost implications in this plan and the README.

### Tests and success criteria

- [x] Unit tests cover valid responses, absent updates, malformed outputs, invalid board mutations, API-board payloads, and history limits.
- [x] Frontend integration coverage verifies board context is sent and the current prompt is not duplicated in history.
- [x] Server-side validation rejects structurally invalid changes before the frontend can apply them.
- [x] The API returns a stable structured contract documented by the request/response models.

## Part 10: AI Chat Sidebar

This phase follows the stable structured AI contract from Part 9.

### Checklist

- [x] Add a responsive, prominent AI co-pilot launcher and right-side assistant workspace without removing core board actions.
- [x] Support composing, submitting, viewing, and clearing chat history.
- [x] Show loading, provider, rate-limit, and rejected-update states clearly.
- [x] Apply an accepted board update and refresh the visible board automatically.
- [x] Preserve keyboard accessibility and usable narrow-screen behavior.
- [x] Keep AI features separate from the core board path when the feature is unavailable.

### Tests and success criteria

- [x] Component tests cover opening, submitting, and rendering assistant responses; core error and save flows remain covered.
- [x] Frontend update handling applies accepted structured AI updates through the existing save path.
- [ ] Playwright tests cover a live chat workflow on desktop and mobile; this remains environment-dependent because it consumes provider quota.
- [x] The core Kanban workflow remains usable when AI is closed, unavailable, rate-limited, or failing.

## Part 11: Multi-User Authentication

This phase follows the stable AI-assisted single-board application from Parts 7–10. It replaces the Part 4 fake sign-in gate (hardcoded `user`/`password`, client-only session) with real accounts, and moves board storage off the shared JSON file from Part 5/6 onto a per-account SQLite store.

### Checklist

- [x] Add sign up, sign in, sign out, and forgot/reset password, backed by bcrypt-hashed passwords.
- [x] Move sessions server-side, tracked via an httpOnly `kanban_session` cookie (no JWT-in-localStorage).
- [x] Migrate board storage from the shared `kanban-database.json` file to SQLite (`backend/app/repository.py`), with relational tables (`users`, `boards`, `columns`, `cards`, `sessions`, `password_resets`) linked by id.
- [x] Give every account its own private board, seeded from the same `DEFAULT_COLUMNS` the JSON store used - still exactly one board per user at this point (relaxed to many in Part 12).
- [x] Re-scope board endpoints from `user_id`-in-the-URL to session-derived identity (`GET/PUT /api/board`, no id parameter yet).
- [x] Decide the password-reset UX: no real email provider - `POST /api/auth/forgot-password` returns the reset token directly in its response, and the frontend displays it/the reset link on screen. Documented as an explicit, deliberate limitation (local/single-instance app), not an oversight.
- [x] Store session tokens and password-reset tokens only as SHA-256 hashes, never raw.
- [x] Sync `CLAUDE.md`, `README.md`, and the frontend sign-in screen to the new real-auth flow, replacing every reference to the Part 4 demo credentials.

### Tests and success criteria

- [x] Backend unit/integration tests cover signup, duplicate-username rejection, login (correct/incorrect password), logout, session expiry, and the full forgot-password → reset-password → login-with-new-password flow.
- [x] Frontend component tests cover the sign-up/sign-in/forgot-password forms and the logged-out → logged-in → logged-out transition against the real API instead of the old client-only demo gate.
- [x] Playwright covers a real signup-through-board workflow at desktop and mobile widths.
- [x] No password or session token is ever logged, returned in an error message, or stored unhashed.

### Part 11 validation record

- [x] Backend suite passes: 28 tests (up from 22 pre-auth), covering auth, sessions, password reset, and the now-session-scoped board routes.
- [x] Frontend suite passes: 21 unit tests (up from 15) across `board.test.tsx`, `home.test.tsx`, and a substantially rewritten `sign-in.test.tsx`; Playwright covers the signup-to-board workflow at desktop and mobile widths.
- [x] `CLAUDE.md`/`README.md` updated to describe real accounts, bcrypt, and SQLite in place of the fake sign-in and JSON store.

### Part 11 decisions

- No real email delivery, OAuth/SSO, or production-hardening (HTTPS enforcement, secret rotation, multi-instance session storage) - this remains a local/single-instance app by design, per the project's "keep it simple" convention, not a gap to close later.
- Passwords are bcrypt-hashed with the standard 72-byte truncation; this is a known bcrypt limitation, not treated as a bug.

## Part 12: Multi-Board Support

This phase follows the stable single-board persistence, AI integration, and multi-user authentication from Parts 7–11. It relaxes the "one board per user" rule established in Part 11 to "one or more boards per user," while keeping every other MVP constraint (fixed 5 renameable columns per board, card title+details only, no search/archive) unchanged.

### Checklist

- [x] Relax the SQLite schema's 1:1 user:board enforcement (`boards.owner_id UNIQUE` → a plain indexed column) via an idempotent, detection-based migration in `KanbanRepository.__init__` (no `schema_version` field; the codebase has never tracked one) - non-destructive, since every existing row was already exactly one board per user.
- [x] Drop the vestigial `users.board_id` column (written at signup, never read by the repository) as part of the same migration.
- [x] Add `list_boards`, `create_board`, and `delete_board` to `KanbanRepository`; scope `get_board`/`save_board` to `(user_id, board_id)` with an explicit ownership check.
- [x] Replace `GET/PUT /api/board` with `GET/POST /api/boards` and `GET/PUT/DELETE /api/boards/{board_id}` - a clean cutover, no deprecated alias, since frontend and backend deploy together.
- [x] Decide cross-user access behavior: a board id that exists but isn't owned by the caller returns 404 (not 403), so it's indistinguishable from a genuinely nonexistent id.
- [x] Decide the delete-last-board rule: every account always keeps at least one board; deleting your only board is rejected with 409. This avoids ever needing a zero-board empty state.
- [x] Add a client-side (not URL-routed) board switcher: `frontend/app/page.tsx` tracks `boards`/`activeBoardId` as state, not a new `/boards/[id]` route - there was no routing infrastructure to build on (everything lived at `/`), and nothing requires shareable board URLs.
- [x] Guard against a save-in-flight race when switching boards: `persistBoard` in `page.tsx` captures the board id being saved and discards a stale response/rollback if the active board has since changed.
- [x] Fix the pre-existing AI co-pilot stub that hardcoded `id: "demo-user-board", owner_id: "demo-user"` in `board.tsx` - it now receives the real active board's identity via props.
- [x] Add a `BoardSwitcher` component (new boards, switching, deleting) in the topbar, following the existing `RenameColumnDialog`/`DeleteCardDialog` dialog pattern for the new `CreateBoardDialog`/`DeleteBoardDialog`.
- [x] Fix a bug found while testing the switcher: renaming a board did nothing, because the backend had no `PATCH /api/boards/{board_id}` route at all - added it.
- [x] Fix a second switcher bug: re-selecting the already-active board got stuck on "Loading your board..." forever, caused by a `useEffect` dependency array that didn't re-fire for a same-id reselect.
- [x] Harden the AI co-pilot's `board_update` validation to check every card's `id`/`title` shape, not just column shape - closes a gap where a model response using `name` instead of `title` passed validation, silently failed to save, and rolled back while the chat still claimed success. The system prompt now spells out the exact card field names.

### Tests and success criteria

- [x] Backend: board-route tests rewritten for the `/api/boards/*` shape; new tests cover list/create/delete, cross-board isolation, cross-user 404, not-found 404, cannot-delete-last-board 409, and a dedicated migration test that hand-builds a legacy-schema SQLite file and confirms it migrates cleanly.
- [x] Frontend: `home.test.tsx` mocks updated to the new routes; new tests cover creating/switching boards and a race test (switch boards while a save is in flight; the stale response must not clobber the newly active board).
- [x] Playwright: existing "My board" heading assertions remain valid unchanged; a new e2e test covers create/switch/isolate across boards and confirms the active board survives a reload.
- [x] A regression test pins down the AI field-name-drift fix (`test_ai_chat_retries_when_card_update_omits_title`), written after reproducing the bug by hand while capturing a demo screenshot.
- [x] Full validation suite passes: backend `uv run pytest -q` (41 tests), frontend lint/`tsc`/Vitest (25 tests)/build/Playwright (5 tests × 2 viewports = 10 runs).

### Part 12 decisions

- No "last active board" persistence server-side - the frontend defaults to the first board in `list_boards()` order, keeping `get_board`/`save_board` read paths free of write side effects.
- No board sharing/collaboration, no folders/workspaces, no per-board permissions - each board still belongs to exactly one user; this is a scoped relaxation of the 1:1 constraint, not a new collaboration feature.

## Part 13: Persistent Postgres Storage

This phase follows the deployed app from Part 12 (live on Vercel + Render, per the README's Live Demo section). It replaces SQLite with Postgres as the backend's storage engine, prompted by discovering that neither the local Docker setup nor the Render deployment actually persisted data across a restart.

### Checklist

- [x] Diagnose why deployed data wasn't surviving: `docker-compose.yml` had no volume mount for `backend/data`, and the Dockerfile only copied `app/`, so the SQLite file lived only in each container's throwaway writable layer - `docker compose down` (what `scripts/stop.sh` runs) destroyed it every time. Render's free web-service tier has no persistent-disk option at all, and idle spin-down/redeploys hand the app a brand-new container.
- [x] Choose a fix: a managed Postgres database as a separate, independently-persistent service, rather than a paid Render disk (would keep SQLite but cost ~$7/mo and tie storage to one service instance).
- [x] Pick Neon as the provider: its free tier has no expiry (unlike Render's own free Postgres, which auto-deletes after 30 days) and auto-wakes on the next query after scaling to zero, matching the app's existing cold-start-after-idle behavior.
- [x] Rewrite `backend/app/repository.py` from `sqlite3` to `psycopg`/Postgres: `%s` placeholders, `dict_row` cursor factory (keeps `row["col"]` access unchanged), `BIGSERIAL`/`BOOLEAN` in place of SQLite's `AUTOINCREMENT`/`INTEGER`-as-bool, `psycopg.errors.UniqueViolation` in place of `sqlite3.IntegrityError`. Drop the Part 12 PRAGMA-introspection migration entirely - it only exists to repair a legacy SQLite shape with no Postgres equivalent.
- [x] Add a `boards.row_id BIGSERIAL` column purely to preserve insertion order for `list_boards` - Postgres has no implicit `rowid` the way SQLite did, and the frontend's `activeBoardId` default depends on that order being stable.
- [x] Switch `KanbanRepository`/`main.py` from a `KANBAN_DATA_PATH` file path to a required `DATABASE_URL` connection string - fail fast at startup if unset, rather than silently falling back to a path that no longer means anything.
- [x] Standardize on Postgres everywhere (dev, test, prod) rather than keeping SQLite as a second code path behind an abstraction layer - decided as unnecessary complexity for this project's "keep it simple" convention. Local dev/test Postgres runs as a `postgres` service in `docker-compose.yml`, backed by a named volume.
- [x] Update `backend/tests/test_main.py` to run against real Postgres: an autouse fixture truncates all tables between tests instead of each test getting its own SQLite file via `tmp_path`. Drop the SQLite-only legacy-migration test; rewrite the corrupt-database test to drop a table instead of writing garbage bytes into a file.
- [x] Sync `.env.example`, `CLAUDE.md`, `README.md`, and `backend/README.md` to describe `DATABASE_URL` - `backend/README.md` was also fixing pre-existing staleness (it still described the long-gone JSON store, a `demo-user`, and `/api/users/{id}/board` routes from before Part 11) while in there.

### Tests and success criteria

- [x] Backend suite passes against real Postgres, not just SQLite.
- [x] A local Docker Compose cycle (`up --build` → sign up → `down` → `up --build` again, i.e. exactly what `scripts/stop.sh`/`start.sh` do) proves the account and board survive, which they did not before this phase.
- [x] The exact production code path (`uv run uvicorn` with `DATABASE_URL` set to the real Neon connection string) is exercised locally - signup, board read, and a direct query against Neon confirming the rows landed - before anything is pushed to the branch Render auto-deploys from.
- [ ] After merge: confirm a Render service restart no longer wipes data (the original bug this phase fixes), now against the real deployment.

### Part 13 validation record

- [x] Backend suite passes: 40 tests (41 minus the dropped SQLite-migration test, plus one rewritten corrupt-database test) against a real Postgres instance.
- [x] Verified locally end-to-end twice: once against local Docker Postgres (survives `docker compose down`/`up`), once against the real Neon database used by the Render deployment (verified via direct query, not just HTTP response).
- [x] Opened as [PR #12](https://github.com/akhilvamsi-gogula/Kanban-board/pull/12) (`postgres-persistence` → `main`) rather than committed straight to `main`, so the Render-redeploy verification step above happens after review/merge.

### Part 13 decisions

- No migration of pre-existing local/deployed SQLite data - both were already effectively lost/ephemeral test data, so the new Postgres schema starts empty rather than writing a one-off import script for throwaway rows.
- Timestamps stay `TEXT` (ISO strings) in Postgres rather than becoming native `TIMESTAMPTZ` columns - not idiomatic Postgres, but it avoids touching the existing `_isoformat`/`_parse` helpers for no behavioral gain, since comparisons already happen in Python.

## Part 15: CI Pipeline, Session Cookie Hardening, and an AI Behavior Eval Harness

This phase follows a QA-perspective review of the whole application (backend, frontend, security, performance, AI-specific testing) done in Part 14's spirit but broader in scope. It picks the three highest-leverage findings from that review and closes them.

### Checklist

- [x] Add `.github/workflows/ci.yml`: a `backend` job (Postgres 16 service container, `uv sync --frozen`, `uv run pytest -q`) and a `frontend` job (`npm ci`, lint, `tsc --noEmit`, Vitest, `next build`), both on push to `main` and on every pull request. Before this, all 66+37 tests only ever ran manually/locally - nothing stopped a broken commit from merging.
- [x] Fix the session cookie's `secure` flag: it was hardcoded `secure=False` (`backend/app/main.py`), meaning it would still be transmitted over a downgraded plain-HTTP connection even though the deployed app is HTTPS-only. Now `SESSION_COOKIE_SECURE = bool(os.getenv("RENDER"))` - Render sets `RENDER=true` on every service it runs, so this is `True` in production and `False` for local dev/Docker Compose (plain HTTP), with no new required config to remember to set.
- [x] Add `backend/eval/ai_eval.py`, a manual (not CI, not pytest) regression harness that sends real prompts to the live Groq model through a running backend and asserts on the structured `board_update` contract, never on exact wording - the same "assert the contract, not the model's words" philosophy the mocked unit tests already use, applied to live-model drift detection instead of shape-handling. Covers: rename/add/remove-card happy paths, a pure question that should produce no `board_update`, a guardrail probe (asking for extra columns, which the app must refuse), and an adversarial HTML-looking card title (confirming the backend stores it literally rather than mangling it).
- [x] Ran the eval harness against the real model once: 5/6 passed. The one failure (`add_card`) returned a live 502 "Groq returned an invalid board update" after exhausting both retry attempts - a genuine, real instance of the small-model unreliability the backend's retry logic exists to paper over, caught by hitting the actual model rather than a mocked payload. A second run to confirm reproducibility instead hit Groq's own rate limit and then the app's own 10-req/min-per-IP limiter (`enforce_ai_rate_limit`), which is itself a useful confirmation that the limiter works as designed under rapid eval-harness traffic; further runs were deliberately not made to avoid spending more of the shared Groq free-tier quota than needed to make the point.

### Tests and success criteria

- [x] `test_session_cookie_is_not_secure_by_default_for_local_http_dev` and `test_session_cookie_is_secure_when_running_on_render` (`backend/tests/test_main.py`) pin both branches of the new cookie logic.
- [x] Backend suite passes: 66 tests (up from 64 at the end of Part 14).
- [x] `eval/ai_eval.py --help` runs; the harness itself was exercised against the real Groq API as described above (not part of the automated suite by design).
- [x] CI workflow YAML is syntactically valid and mirrors the exact commands documented in `CLAUDE.md`/`backend/README.md` for local validation, so a green CI run means the same thing a developer's local check means.

### Part 15 decisions

- The CI workflow intentionally excludes Playwright e2e - it needs browser binaries and a live backend+DB, making it a slower, heavier job better suited to a separate, optionally-triggered workflow than to a fast on-every-push gate. Not added this phase; noted as a follow-up.
- The AI eval harness stays a manual script, not a scheduled GitHub Action - it costs real Groq quota per run and asserts against a non-deterministic model, so gating anything on it (or running it unattended on a schedule against a shared free-tier key) was judged the wrong tradeoff for this project's scale.
- Mypy/ruff for the backend, dependency vulnerability scanning, coverage measurement, and cross-browser/accessibility/visual-regression e2e coverage were all identified in the same review but are not part of this phase - listed here so they aren't lost, not because they're unimportant.

## Cross-Phase Completion Checks

- [x] Update this document when requirements or architectural decisions change.
- [x] Record the provider/model and user-approved AI design decisions.
- [x] Keep tests close to the behavior they protect and avoid unrelated feature work.
- [x] Run the relevant validation commands before declaring a phase complete.
- [x] Do not commit secrets, generated test artifacts, or local database data.

### "Is everything up to date?" - the fixed checklist

Every prior sweep of this kind was ad hoc, which is why things kept slipping through and had to be re-caught later (see Learnings). Run *this exact list* every time, instead of improvising a fresh one:

- [ ] `git branch -r` / `git log --all --not --remotes=origin/main` - any commit fixing a real bug or gap that isn't reachable from `main`? A fix on an abandoned branch is not a fix.
- [ ] Does every merged feature commit since the last check have a corresponding Part in this document? Diff the commit list against the Part headings, don't rely on memory of "I think that's documented."
- [ ] Grep the frontend for copy describing superseded behavior (`session only`, `demo`, `local only`, old credential names, old field/route names) - UI text drifts silently because nothing type-checks prose.
- [ ] Grep root `README.md`, `backend/README.md`, `frontend/README.md`, and `CLAUDE.md` for the same category of drift, plus stale test counts and removed env var names.
- [ ] State the check's scope explicitly in the answer (what was actually grepped/run, not just "yes, up to date") - an unqualified "yes" is what turns a partial check into a false claim.

## Learnings

Non-obvious lessons from building and shipping this project, kept here so they inform future decisions instead of being re-learned.

**"Works when I test it" and "actually persists" are different claims.** Part 13 exists because the app behaved correctly in every manual test - signup worked, boards saved, the AI co-pilot ran - while silently losing all of that data on every container restart. Day-to-day development never restarts the container, so an ephemeral-storage bug like this is invisible until someone specifically tests the restart/redeploy path. Any "is this persistent?" claim needs its own explicit test (stop the process, start it again, check the data), not an inference from the feature otherwise working.

**A missing volume mount and a missing persistent-disk tier fail identically: silently.** Neither Docker (`docker-compose.yml` had no volume for `backend/data`) nor Render's free tier (no persistent-disk option at all) raised an error - they just discarded state on the next container. Infra that "works" without an explicit persistence declaration should be assumed ephemeral until proven otherwise.

**Local code changes and a deployed app are two different states, even on a solo project with one branch.** Mid-way through Part 13, `DATABASE_URL` was set on Render and a Neon connection string pasted in, and the frontend still "worked fine" - because the live Render service was still running the old SQLite code from `main`; nothing had been pushed yet. Verify against the exact commit that's actually deployed, not the one on disk locally.

**Verify against the real target before it's live, when you can.** Rather than pushing straight to `main` (which auto-deploys) to see if the Postgres migration worked, the same code was run locally with `DATABASE_URL` pointed at the real Neon connection string first - same code path, same database, zero deployment risk. Confirming end-to-end against production-shaped infrastructure without touching production is usually possible and worth the extra step.

**A field-name typo from a small LLM can look like success.** The Part 12 AI-hardening fix exists because a model returned a card using `name` instead of `title`; validation checked column shape but not every card field, so the bad update passed validation, failed to save, rolled back - and the chat still said it succeeded. Validate the leaves of a structure an LLM produces, not just its outline, and treat "the assistant claims a change happened" and "a valid `board_update` was actually returned" as two separate facts to check (this became `CLAIMED_CHANGE_PATTERN` server-side).

**Schema migrations don't require a version table to be safe.** Part 12's legacy single-board-schema upgrade has no `schema_version` field anywhere in this codebase; it detects the old shape structurally (a `UNIQUE` constraint via `PRAGMA` introspection) and only migrates when that shape is actually found. Detection-based migrations are a legitimate lighter-weight alternative to version tracking when there's exactly one legacy shape to detect.

**Prefer "indistinguishable from nonexistent" over "exists but forbidden" for ownership-scoped resources.** Both Part 11 (sessions) and Part 12 (multi-board ownership) return 404, never 403, for a resource that exists but isn't the caller's - so a bad guess can't be used to enumerate which ids are real. Decided once in Part 12 and it fell out naturally everywhere else ownership checks were added.

**A capture-and-compare guard beats a lock for optimistic-UI races.** The stale-save race fixed in Part 12 (switching boards while a save is still in flight) isn't solved with a mutex - `persistBoard` just captures which board id it's saving for and discards its own result if the active board has changed by the time it resolves. Cheap, and correct without blocking the UI.

**Generic CLI onboarding scripts can carry more scope than the task needs, even from a legitimate, official tool.** The Neon CLI onboarding script pasted in during Part 13 was genuine (verified via `npm view`, not a typosquat), but running it as given would have minted an account-wide MCP API key and provisioned an object-storage bucket - neither related to "get a Postgres connection string." Checking `--help` output before running unfamiliar `-y`/auto-confirm flags surfaced this before anything was installed.

**Evaluate a "free" provider tier by its actual guarantees, not just its price.** The Groq migration (superseding Part 8's OpenRouter integration) and the Neon-over-Render-free-Postgres choice in Part 13 both turned on the same axis: Groq's free tier runs on dedicated hardware rather than a shared/oversubscribed pool, and Neon's free tier has no expiry where Render's free Postgres auto-deletes after 30 days. "Free" tiers of the same-sounding feature can have materially different reliability/durability guarantees worth checking before picking one.

**Mock the provider call, assert the contract - not the model's actual words.** Every AI-path backend test mocks the Groq HTTP call directly and asserts on the backend's own validation/retry contract (malformed JSON, a claimed-but-missing update, a wrong field name, a timeout), never on what a live model happens to say. This is what makes a non-deterministic feature testable deterministically, and it's how the field-name-drift regression above got a permanent test instead of a one-off fix.