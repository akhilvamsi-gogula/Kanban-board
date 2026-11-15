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
- [x] Added `kanban-database.schema.json` as the machine-readable contract (removed in Part 21: it described the retired JSON store).
- [x] Added `kanban-database.example.json` as the seeded instance (removed in Part 21).
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

## Part 14: Cross-Account State Leak Fix, AI Chat Logging, and Boundary Test Hardening

This phase follows the deployed Postgres migration from Part 13. It started from a real bug found by hand: after signing up a fresh account (`akhiltesting`) in the same browser tab used moments earlier for a different account (`testuser`), the AI assistant panel showed `testuser`'s prior conversation ("Add random cards for testing" / "Added five random test cards...") even though `akhiltesting` had never sent a message and had a genuinely empty (correctly seeded) board.

### Checklist

- [x] Diagnose the stale-chat-history bug: `<Board>` in `frontend/app/page.tsx` was rendered without a `key` prop and is never otherwise unmounted, so React reused the same component instance across login/logout/signup. `assistantMessages` (and other client-only UI state - `isAssistantOpen`, `cardDialog`, `assistantDraft`) lived in local `useState` and survived across accounts in the same tab, even though the actual board data (`columns`, a controlled prop refetched per account) was always correct.
- [x] Fix by keying `<Board>` on the signed-in username - `key={username ?? "signed-out"}` - so React fully remounts it, resetting all internal state, on every login, logout, and signup.
- [x] Confirm chat history was never persisted anywhere (no `localStorage`, no backend table at the time) - the leak was purely an in-memory React state lifetime bug, not a data-layer one.
- [x] Add a `ai_chat_messages` table (`user_id`, `board_id`, `role`, `content`, `created_at`) and log every `/api/ai/chat` prompt and reply to it, at the user's explicit request for hands-on learning/analysis (querying different users' AI usage directly in Neon). Attribution uses the client-supplied `board.owner_id`/`board.id` from the request, not a verified session, since `/api/ai/chat` remains intentionally unauthenticated (rate-limited only) per its existing design - this is analysis data, not a tamper-proof audit log.
- [x] Deliberately did not add a `GET` history endpoint or any frontend UI for the new table - out of scope for what was asked, per the project's "no speculative features" convention; querying Neon directly is sufficient for the stated use case.
- [x] Expand backend and frontend test coverage with boundary/edge cases well beyond the two items above: signup/login field-length and character-pattern boundaries, bcrypt's documented 72-byte truncation behavior, the full password-reset token lifecycle (invalid/reused/expired tokens, session invalidation on reset), session expiry, the auth rate limiter's boundary, board/column/card structural validation (duplicate column/card ids, non-contiguous card positions, invalid card-id pattern, title/name length boundaries), AI chat prompt-length and history-trimming boundaries, and frontend dialog whitespace-only-input guards (card title, column rename, board name).
- [x] Ran the fixed staleness-audit checklist from Cross-Phase Completion Checks: `git log --all --not origin/main` surfaced one commit (`e514f69`, on the abandoned branch `origin/claude/seeded-board-new-account-tm9bd8`) fixing the same stale footer copy already fixed on `main` via a separate commit (`50e7473`) - a duplicate, not a gap. No stale copy found grepping the frontend for superseded-behavior language, and no drift found grepping `README.md`/`backend/README.md`/`frontend/README.md`/`CLAUDE.md` for stale test counts or removed env var names.

### Tests and success criteria

- [x] A regression test (`home.test.tsx`) signs in as one account, has the AI assistant respond, logs out, signs in as a different account, and asserts the assistant panel shows only the default placeholder message with no leftover history from the first account.
- [x] A backend test confirms `/api/ai/chat` logs both the prompt and the reply to `ai_chat_messages`, correctly scoped to the `user_id`/`board_id` from the request, and a second test confirms `NULL` ids are stored (without erroring) when no board is attached to the request.
- [x] Backend suite passes: 64 tests (up from 41 at the end of Part 13), covering the logging feature plus all the boundary/edge cases listed above; `test_main.py`'s table-truncation fixture extended to include `ai_chat_messages`.
- [x] Frontend suite passes: 37 tests (up from 26), including the cross-account regression test above, new whitespace-input-guard tests in `board.test.tsx`, new server-error/in-flight-disable/invalid-token tests in `sign-in.test.tsx`, and a new `board-switcher.test.tsx` covering the delete-button-hidden-for-one-board rule, delete confirmation, and whitespace-only board names.
- [x] Lint, `tsc --noEmit`, and `next build` all pass.
- [ ] Playwright e2e not re-run this phase - the existing suite covers golden-path flows only (not boundary cases) and needs browser binaries plus a live backend/DB; left as an optional follow-up rather than run speculatively.

### Part 14 decisions

- No new API endpoint or frontend UI for `ai_chat_messages` - direct Postgres/Neon SQL queries are sufficient for the stated learning/analysis use case, and adding either would be scope beyond what was asked.
- No persistence added for the AI assistant's chat history itself (e.g. `localStorage`) - the bug was React state outliving the account it belonged to, not the absence of durability; a `key`-based remount fixes that at zero backend cost and matches the project's "reset on refresh/logout" model for other client-only UI state.

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

## Part 16: Password Visibility Toggle

Small, user-requested UX fix: every password field (sign-in, sign-up password + confirm password, reset-password's new password) is a raw `type="password"` input with no way to check what was typed before submitting.

### Checklist

- [x] Add a reusable `PasswordField` component (`frontend/components/sign-in.tsx`) wrapping each password `<input>` with an eye/eye-off icon button (`lucide-react`'s `Eye`/`EyeOff`) that toggles `type` between `password` and `text`. Each field's visibility state is local and independent - toggling one field's visibility does not affect any other.
- [x] Style the toggle in `frontend/app/globals.css` (`.auth-password-field`, `.auth-password-toggle`) as an absolutely-positioned button inside the existing input, with `padding-right` on the input so typed text never runs under the icon.
- [x] Keep the existing `<label htmlFor>`/`id` association unchanged so accessibility and existing `getByLabelText`-based component tests keep working without modification; the toggle button gets its own `aria-label` ("Show password" / "Hide password") and `aria-pressed` state instead of reusing the field's label.
- [x] Fix a real regression this introduced: Playwright's `getByLabel` matches by substring by default (unlike Testing Library's exact-by-default `getByLabelText`), so the toggle button's `aria-label="Show password"` made `page.getByLabel("Password")` in `frontend/e2e/kanban.spec.ts` ambiguous (matched both the input and the button). Fixed the two non-exact call sites (`signIn` helper, wrong-password assertion) to pass `{ exact: true }`, matching the pattern the `signUp` helper already used.

### Tests and success criteria

- [x] `npm run lint` passes.
- [x] `npx tsc --noEmit` passes.
- [x] `npm run test -- --run` passes: 37 tests, unchanged - `getByLabelText` locators were unaffected since Testing Library matches labels exactly by default.
- [x] `npm run build` passes.
- [x] `npm run test:e2e` passes: 10 tests (desktop + mobile), after the `{ exact: true }` fix above - first run surfaced the ambiguous-locator failure on both viewports for `requires sign-in and supports logout`, confirming the fix was necessary rather than precautionary.
- [x] `uv run pytest -q` (backend) passes: 66 tests, unaffected since this is a frontend-only change.

### Part 16 decisions

- Visibility state lives per-field (not one shared toggle for the whole form) so revealing the sign-up password doesn't also reveal the confirm-password field - matches how most password managers and browsers implement the same affordance.
- No new automated test added specifically for the toggle's click behavior (show text, click again, hide) - judged low-risk, standard-pattern UI with no business logic; existing lint/type/build/e2e coverage already exercises the changed files.

## Part 17: Mobile Drag and Drop (issue #25)

Drag and drop does not start on Android/iOS. Root cause: dnd-kit's pointer listeners sit on a 17px grip button whose CSS has no `touch-action: none`, so the browser claims the touch as a scroll, fires `pointercancel`, and the `PointerSensor` never activates.

### Checklist

- [x] `globals.css`: `.drag-handle` gets `touch-action: none`, a 36x36px hit area under `@media (pointer: coarse)` (icon size unchanged; 36 rather than 40 so it doesn't overlap the card title), and no text selection / long-press callout.
- [x] `board.tsx`: `MouseSensor` (distance 8) + `TouchSensor` (delay 150ms, tolerance 8) + existing `KeyboardSensor`, replacing the single `PointerSensor`.
- [x] Cross-column touch drag: dnd-kit auto-scroll moves `.board-grid` sideways while dragging - verified in the Android e2e run (a drop aimed near the right edge scrolls on to the next column); `.app-shell { overflow: hidden }` does not clip it because `.board-grid` is its own scroll container.
- [x] Drag overlay matches the dragged card's real width instead of a fixed 230px.
- [x] Small-screen pass at 360px (screenshots): topbar stays on one line (smaller brand, no-wrap switcher with ellipsis), toolbar stacks with the AI launcher full width, "1 cards" -> "1 card", no horizontal page overflow; `100dvh` after each `100vh`; `viewport.interactiveWidget: "resizes-content"` so the on-screen keyboard shrinks the layout and the fixed AI composer / dialog buttons stay visible on Android.
- [x] `playwright.config.ts`: Android (`Pixel 7`) project added; backend `webServer` command is cross-platform (`uv run --directory ../backend uvicorn ...`).
- [x] Found while testing, fixed here rather than in Part 19 because it lost real edits: concurrent full-board PUTs could land out of order and an older save overwrote a newer edit on the server (reproduced: rename a column, delete a card, reload - the rename was gone). Saves are now serialized in `page.tsx` (`flushSaves`), only the latest state is queued, stale responses are ignored, and the browser warns before leaving while a save is pending.
- [x] Found while testing: an AI update that renames the board never persisted the new name (`persistBoard` read a stale `boardName` from its closure). Fixed with `boardNameRef`.
- [x] Found while testing: the e2e suite (now 17 sign-ups/min from 127.0.0.1) tripped the 20/min auth rate limit. `KANBAN_AUTH_RATE_LIMIT` env override, set to 1000 for the Playwright-started backend only. Same root cause as Part 19's shared-IP limiter problem.

### Tests and success criteria

- [x] New e2e test drags a card within a column and across columns: mouse on `desktop`, real touch (Chromium CDP `Input.dispatchTouchEvent`, so the browser's own gesture handling is exercised) on `android`. Skipped on `mobile` (WebKit) because Playwright cannot script real touch input there - deviation from the plan, recorded here.
- [x] The touch test fails with the fix reverted (card order unchanged) and passes with it.
- [x] New Vitest tests: saves are serialized and an older response never overwrites a newer edit; an AI board rename is saved with the new name. Both fail against the old `page.tsx`.
- [x] Full validation set passes (record below).
- [x] Confirmed by the user on a real Android phone (Galaxy S24 Ultra): drag works.

### Part 17 follow-up: phone layout (found in the user's phone check)

- [x] The Done column was hard to find: only a sliver of the second column hinted that the board scrolls sideways. Added a row of column chips (`components/column-nav.tsx`, phone and tablet widths only) that jumps to the tapped column, and `scroll-snap-type: x proximity` so a swipe lands on a whole column. Snapping is turned off while a card is dragged so it doesn't fight dnd-kit's auto-scroll.
- [x] The AI panel's text box sat below the screen: the panel was sized to the full window, and Samsung Internet's bottom toolbar covers the window's lower edge. On phones the panel now uses `height: 100dvh - 20px` (the visible height) and a shorter text box.
- [x] New e2e tests: at 384px wide, the Done chip brings Done into view and the AI text box and Send are on screen; the chips are hidden on desktop. `npm run lint`, `tsc`, Vitest (39) and e2e (21 passed, 3 skipped by design) pass.
- [x] Confirmed by the user on the S24 Ultra: Done is reachable and the AI text box is on screen.

### Part 17 validation record

- [x] `npm run lint` passes.
- [x] `npx tsc --noEmit` passes.
- [x] `npm run test -- --run` passes: 4 files, 39 tests (37 before + 2 save tests).
- [x] `npm run build` passes.
- [x] `npm run test:e2e` passes: 17 passed, 1 skipped (touch drag on WebKit), across `desktop`/`mobile`/`android`; 4 consecutive full runs with no failures.
- [x] `uv run python -m pytest -q` (backend) passes: 66 tests.

### Part 17 decisions

- `TouchSensor` with a 150ms press delay, not an instant start: the handle has `touch-action: none` so it never scrolls, but the delay keeps an accidental brush of the handle while scrolling the column from turning into a drag.
- Saves are serialized and coalesced (latest state wins) instead of numbered-and-raced: since each PUT carries the full board, sending only the newest state after the in-flight one is both correct and cheaper. Kept in `page.tsx`, no new abstraction.
- Not adding `keepalive` to the save fetch: it caps the request body at 64KB, which a large board can exceed; the `beforeunload` warning covers leaving mid-save instead.

## Part 18: Cold-Start Wake-Up Screen (issue #23)

Render's free tier sleeps the backend after 15 minutes idle; the next visitor waits ~30-50s while it boots. Today the page shows a bare "Loading...", then silently falls back to the sign-in form if the session check fails, and the first sign-in hangs or errors with no explanation.

### Checklist

- [x] Backend `GET /api/health` (no database access) - reachable through the `/backend-api/*` rewrite, unlike `/health`.
- [x] `lib/api.ts` `waitForBackend()`: polls `/health` with a 10s per-attempt timeout, retries every 1.5s on network errors and **any 5xx** for up to 90s; any other status (even a 404 from an older backend) counts as awake. Fired as soon as the page loads, so it doubles as the warm-up ping.
- [x] `components/wake-up-screen.tsx`: shown only if the backend hasn't answered within 2s. "Waking up the server", one-line free-tier explanation (usually 30-50s), progress bar easing toward 95%, elapsed seconds, `role="status"` heading and a `role="progressbar"` with an elapsed-time `aria-valuetext`. After 90s: "The server is not responding" + Try again.
- [x] `page.tsx`: `waitForBackend()` then `getCurrentUser()`, replacing the `isCheckingSession` "Loading..." placeholder (a blank shell for the first 2s, so a warm server shows no flash).
- [x] `Dockerfile`: `uv run --no-sync` so boot skips the dependency re-check.

### Tests and success criteria

- [x] Vitest (`tests/wake-up.test.tsx`, 7 tests, fake timers): no wake screen on a fast backend; screen appears after 2s, elapsed and progress advance, continues to sign-in when the backend answers; error + working Try again after 90s; `waitForBackend` retries on network error/500/502/503/504, treats 404 as awake, gives up after the timeout; progress never passes 95%.
- [x] Backend test: `/api/health` answers even with no repository available.
- [x] Manual, real app (Pixel 7 emulation, backend stopped, started ~12s in): no screen at 1s, wake screen at 6s with progress 29%, sign-in appeared on its own at 14s. Screenshot checked.

### Part 18 validation record

- [x] `npm run lint`, `npx tsc --noEmit`, `npm run build` pass.
- [x] `npm run test -- --run` passes: 5 files, 46 tests (39 + 7 wake-up tests); 3 consecutive runs.
- [x] `npm run test:e2e` passes: 17 passed, 1 skipped; 2 consecutive full runs.
- [x] `uv run python -m pytest -q` passes: 67 tests (66 + `/api/health`).
- [x] Found during the manual check: the first version only retried 502/503/504, but the local Next.js rewrite answers **500** when the backend is down, so it treated a dead backend as awake and dropped straight to sign-in. Now any 5xx means "still waking"; a test covers 500.

### Part 18 decisions

- The bar does not animate to 100% before continuing: the screen is replaced by sign-in or the board the moment the server answers, which is clearer feedback than a final fill animation and needs no extra delay.
- No keep-alive ping (user decision): it would burn most of Render's 750 free hours/month and GitHub cron timing is not exact. Listed under Future scope.

## Part 19: Multi-User Hardening, Review and Refactor (issues #3, #14)

Account data is already isolated (every board query checks `owner_id`). The review found problems that grow with concurrent users, plus bugs and structural debt.

### Checklist

Concurrency:
- [x] Replace the global `RLock` + new-connection-per-call in `KanbanRepository` with a `psycopg_pool.ConnectionPool` opened in a FastAPI lifespan handler; one transaction per operation. Production uses Neon's pooled (`-pooler`) URL.
- [x] Rate limiters see the real visitor IP: uvicorn `--proxy-headers --forwarded-allow-ips="*"` (Vercel overwrites `X-Forwarded-For` with the visitor IP). Prune empty buckets.
- [x] `/api/ai/chat` and `/api/ai/check` require a session; AI rate limit is per account; chat logs use the session user; the request's `board.id` must belong to that user (else 404).
- [x] Shared Groq budget (8K tokens/min, 1,000 req/day for the whole app): forward Groq's `retry-after` as "AI is busy, try again in N seconds"; compact board JSON; check `reasoning_effort: "low"` against the eval.
- [x] Out-of-order saves - done in Part 17 (saves serialized and coalesced in `flushSaves`).
- [x] `backend/scripts/load_check.py`: N concurrent users sign up, load, edit, save; assert each sees only their own data. Timings for 5 and 25 users, before and after.

Bugs:
- [x] Board is sent to Groq as a Python `repr`, not JSON - use `json.dumps`.
- [x] AI `board_update`: merge into the request's board server-side and validate with `BoardUpdate`, so the frontend always gets a complete valid board (partial updates currently crash `applyAiBoardUpdate`).
- [x] Backend tests default to a separate `kanban_test` database (created if missing) instead of truncating the dev database; importing `app.main` without `DATABASE_URL` no longer crashes test collection.
- [x] New card ids use a random suffix instead of `Date.now()` alone.

Performance:
- [x] `save_board` uses `executemany` and skips the extra read round-trip.
- [x] Fonts via `next/font` (DM Sans, Space Grotesk); drop the render-blocking `@import` and the unused Geist fonts.
- [x] Blocking repository calls in the async AI route run in the threadpool.

Structure:
- [x] Split `backend/app/main.py` into `routers/{auth,boards,ai}.py`, `rate_limit.py`, `ai_service.py`; drop the redundant `asyncio.wait_for`.
- [x] Split `components/board.tsx`: AI panel to `components/ai-assistant.tsx`, pure board operations to `lib/board-ops.ts`; readable JSX.
- [x] Dialogs close on Escape and restore focus.
- [x] Task card `<article>` gets dnd-kit's `role="button"`/`tabIndex` attributes while it also contains the drag/edit/delete buttons (nested interactive controls, found in Part 17's e2e). Move the sortable attributes onto the drag handle so keyboard drag starts from the handle.
- [x] Remove dead code: `.hero*`/`.stat-line` CSS (`.kicker` is still used), unused `public/*.svg`, stale metadata and SQLite mentions.
- [x] `backend/eval/ai_eval.py` signs in before calling the authenticated chat endpoint.

### Tests and success criteria

- [x] Boundary tests (#14): field length limits, position/duplicate-id/5-column rules, session expiry, reset-token reuse/expiry, cross-user access (404), AI request for another user's board, rate-limit window edges, per-account AI limit, AI partial update merge success/failure, out-of-order saves, `board-ops` edge cases.
- [x] Load check passes with 5 and 25 concurrent users; timings recorded below.
- [x] Full validation set passes.

### Part 19 validation record

- [x] Load check (`backend/scripts/load_check.py`, local Postgres, every run isolation ok):

  | Users | Before (RLock, new connection per call) | After (connection pool) |
  |---|---|---|
  | 5 | 4.56s wall, save p50 534ms | 0.63s wall, save p50 29ms |
  | 25 | 21.17s wall, save p50 2598ms / p95 4318ms | 2.42s wall, save p50 147ms / p95 171ms |

  Signup p50 stays ~1s at 25 users: bcrypt cost, deliberately not weakened.
- [x] `uv run python -m pytest -q` passes: 82 tests (67 + AI auth/ownership, role validation, merge, Groq 429, per-account/per-IP/window/sweep rate limits), also without `DATABASE_URL` set.
- [x] `npm run lint`, `npx tsc --noEmit`, `npm run build` pass.
- [x] `npm run test -- --run` passes: 6 files, 59 tests (46 + 9 `board-ops` unit tests, dialog Escape/focus, sortable attributes on the handle, AI history survives closing the panel, Groq-busy message shown).
- [x] `npm run test:e2e` passes: 17 passed, 1 skipped; 2 consecutive full runs.
- [x] `uv run python eval/ai_eval.py` against the refactored backend (real Groq, `reasoning_effort: "low"`): 6/6 passed.

### Part 19 decisions

- Not doing: migrations framework, foreign keys/timestamp type changes on the live Neon schema, state-management library, CSS rewrite, multi-instance session/rate-limit storage (one Render instance is enough at this scale).
- `asyncio.wait_for` around the Groq call is kept, not removed: httpx timeouts apply per read, so a slow keep-alive stream that trickles bytes could otherwise run far past `GROQ_TIMEOUT_MS`. The existing slow-stream test covers this.
- `--forwarded-allow-ips "*"`: anyone calling the Render URL directly (bypassing Vercel) can spoof `X-Forwarded-For` to dodge the per-IP auth limit. Accepted: bcrypt still slows brute force, and AI limits are per account, not per IP.
- `reasoning_effort` stays `"low"`: the eval passes 6/6 with it, and it keeps tokens inside the shared 8K/min budget.
- `.kicker` CSS is kept (the sign-in screens use it); only `.hero*` and `.stat-line` were dead.

## Part 20: AI Co-Pilot Attachments (issue #24)

Attach documents and images to a co-pilot message from phone or PC so it can read them and break them into cards. Device upload only; on Android the system picker already reaches camera, local storage, Google Drive and OneDrive.

### Checklist

- [ ] `uv add python-multipart pypdf python-docx openpyxl python-pptx`.
- [ ] `backend/app/attachments.py`: text from TXT/MD/CSV/JSON/code, PDF, DOCX, XLSX, PPTX; images (PNG/JPG/WEBP) turned into text once at upload by `GROQ_VISION_MODEL` (default `qwen/qwen3.8-27b`, a Groq preview model). Type decided by extension plus content sniffing.
- [ ] `POST /api/ai/attachments` (multipart, signed-in, per-account AI limit): returns `{name, text, truncated}`; nothing stored server-side; parsing in the threadpool; corrupt/encrypted file is a clear per-file 422.
- [ ] `AiChatRequest.attachments`: at most 3 files, 5 MB per file (4 MB per image), 10,000 extracted characters per message (`AI_ATTACHMENT_MAX_CHARS`); placed in the prompt inside delimiters as untrusted reference data.
- [ ] Attachments go with the next message only (not resent every turn) to stay inside the shared 8K tokens/min budget.
- [ ] Only attachment names are logged in `ai_chat_messages`, never contents.
- [ ] Frontend: paperclip + hidden file input, desktop drag-and-drop zone, chips (uploading / ready / shortened / error, removable); `request()` doesn't force a JSON content type for `FormData`.
- [ ] Docs and `.env.example` (`GROQ_VISION_MODEL`, `AI_ATTACHMENT_MAX_CHARS`); an attachment case in `backend/eval/ai_eval.py`.

### Tests and success criteria

- [ ] Backend: one small generated file per format, size/count/type rejections, truncation flag, corrupt/encrypted file, sign-in required, vision call mocked, attachments delimited in the outgoing prompt.
- [ ] Frontend: attach/remove chip, upload error, attachments sent once then cleared.
- [ ] Manual: each format uploads; "break this document into cards" updates the board; Undo reverts it; works from an Android phone.

## Part 21: Whole-Project Review, Edge Cases and Documentation

Done on the review branch (same pull request as Part 19), before Part 20.

### Bugs found and fixed

- [x] **Blank text bricked a board.** A card title, column name or board name made only of whitespace passed the length check, was trimmed to "" and stored. The board then failed validation on every read (HTTP 500) and could not be opened again. Creating a board with a blank name left an unopenable board in the list. Text is now trimmed before the length check (`Text` type in `models.py`), so these are rejected with 422.
- [x] **A null character in any text caused a 500** (Postgres cannot store it). Now rejected with 422; stripped from AI replies before logging.
- [x] **Two simultaneous deletes could remove an account's last board.** `delete_board` now locks the account's board rows first.
- [x] **Typing past a limit looked accepted, then every save failed.** Inputs had no `maxLength`: a 201-character title showed on the board, the save was rejected, and Retry could never succeed. Inputs now carry the backend's limits.
- [x] **Sign-up errors were raw validation text** ("String should match pattern '^[a-zA-Z0-9_-]{3,32}
- In-app OneDrive / Google Drive upload (picker SDK + OAuth app registration) - not needed on Android, where the system picker already reaches both.
- Larger or full-length attachments after a paid Groq tier, or chunked summarisation.
- Removing cold starts entirely: keep-alive ping or a paid Render instance.

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
- [ ] Grep root `README.md`, `backend/README.md`, `frontend/README.md`, and `CLAUDE.md` for the same category of prose drift (superseded behavior, old credential/field/route names, removed env var names).
- [ ] For every *number* claimed in those same docs (test counts, file counts, anything quantitative) - actually run the command that produces it right now (`uv run pytest --collect-only -q` for backend, `npm run test -- --run` for frontend, count e2e `test(` blocks) and compare digit-for-digit against what's written. Do not substitute a text-pattern grep like `[0-9]+ tests?` for this - that exact substitution missed a real instance (README claimed "75 automated tests" with a 40/25/10 per-layer table, actually 113 with 66/37/10, because the digit and the word "tests" weren't adjacent enough for the grep to match).
- [ ] For every screenshot referenced by any doc - compare the commit date that last touched the image file against the most recent frontend commit touching what it depicts (copy, layout, visible behavior). Don't assume "no styling changes happened" without checking dates; a copy-only fix is enough to make a screenshot wrong. Caught for real: `docs/kanban-board-screenshot.png` was committed 11 days before the footer-copy fix it should have reflected, and still shows the old "Changes live in this session only" text baked into the image - the live app has said "Changes save automatically to your account" since `50e7473`.
- [ ] State the check's scope explicitly in the answer (what was actually grepped/run, not just "yes, up to date") - an unqualified "yes" is what turns a partial check into a false claim.

## Learnings

Non-obvious lessons from building and shipping this project, kept here so they inform future decisions instead of being re-learned.

**A grep for a text pattern is not the same claim as "I checked the number."** The Part 14 staleness audit ran `grep -rniE "[0-9]+ tests?" README.md` and found nothing, then reported "no drift found." The README actually said "75 automated tests" with a 40/25/10 per-layer table against a real count of 113 (66/37/10) - the regex missed it because the digit and the word "tests" weren't adjacent (`"75 automated tests"`, `"| 40 |"`). A grep for a pattern proves the pattern doesn't appear; it does not prove the underlying fact is current. Any numeric claim needs its source command re-run and compared, not a pattern search treated as a substitute.
**A screenshot is a claim that ages exactly like prose, but nothing greps an image.** `docs/kanban-board-screenshot.png` was committed 11 days before a footer-copy fix (`50e7473`) and still shows the pre-fix text baked into the pixels. Because there's no keyword to search for inside a PNG, this class of drift needs a different check entirely: compare the screenshot's last-commit date against the last commit touching whatever it depicts, every time - not "no styling changes were made recently" reasoning, which only covers layout, not copy.

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

**Mock the provider call, assert the contract - not the model's actual words.** Every AI-path backend test mocks the Groq HTTP call directly and asserts on the backend's own validation/retry contract (malformed JSON, a claimed-but-missing update, a wrong field name, a timeout), never on what a live model happens to say. This is what makes a non-deterministic feature testable deterministically, and it's how the field-name-drift regression above got a permanent test instead of a one-off fix."). The form now checks username and password itself and names the problem. Same for a too-short new password on reset.
- [x] **Phone keyboards capitalised the first letter of a username**, and usernames are case-sensitive, so sign-in failed for no visible reason. Username fields turn auto-capitalisation off.
- [x] **An expired session left a board whose saves could never succeed.** A 401 during use now returns to sign-in with "Your session has ended".
- [x] **Long unbroken text spilled out of its box** (a 200-character word in a card: 2,238 px of text in a 217 px card; a long board name ran off a phone screen; a long column name pushed its chip off screen). Added wrapping and an ellipsis on chips.
- [x] **Flaky touch drag test.** It did not wait for the previous drop animation or for the press-and-hold to register, and dropped at coordinates computed before the board auto-scrolled. It now waits for both and follows the target. Not an app bug.

### Checked and found correct

- [x] Simultaneous saves of one board queue on the board row; 16 at once all succeed.
- [x] Length boundaries (username 3/32, password 8/128, title 200, details 5,000, column 80, board 120) accept the limit and reject one past it.
- [x] Unicode, HTML-looking and SQL-looking text is stored and shown as literal text.
- [x] Cross-account access returns 404 on every board and AI route.

### Tests and devices

- [x] Backend: 82 -> 105 tests (blank and null text, trim-before-length, details and column-name boundaries, unicode, concurrent saves, concurrent deletes).
- [x] Frontend: 59 -> 70 tests (sign-up validation, field limits, session-expiry notice, wrong password is not a lost session).
- [x] E2E: new `galaxy-s24-ultra` Playwright profile (384 x 824, pixel ratio 3.75); projects renamed to `desktop`, `iphone-13`, `pixel-7`, `galaxy-s24-ultra`. New scenario: maximum-length text stays inside its box on a phone and survives a reload. 9 scenarios x 4 profiles: 32 passed, 4 skipped by design, five consecutive full runs.
- [x] Load check rerun: 5 users 1.2 s, 25 users 3.5 s, isolation ok.

### Documentation

- [x] README rewritten for a reader new to the project: what the app does, how it works, and a detailed testing section (layers, device coverage, edge and boundary cases, load test, AI testing approach, defects found by testing). CLAUDE.md cut from long paragraphs to a short list of commands and pitfalls.
- [x] New `docs/architecture.md` (the detail moved out of CLAUDE.md), `docs/testing.md` (device matrix, edge and boundary cases, load test, real-device checklist) and `docs/deployment.md` (hosting, environment variables, limits).
- [x] `docs/database-schema.md` rewritten: it still described the original JSON-file proposal and SQLite. Removed the two JSON files that belonged to it.
- [x] `frontend/README.md` replaced (it was the create-next-app template and named a font the app no longer uses). `AGENTS.md`: new accounts start with an empty board, not dummy data.

### Not changed, on purpose

- Usernames stay case-sensitive. Making them case-insensitive needs a decision about existing accounts that differ only by case.
- Repository errors stay HTTP 500. No foreign keys or migration tool added.

### Not verified

- Touch drag on a real iPhone (Playwright cannot script real touch input in WebKit).
- The load check against the deployed app (it creates real accounts).

## Future Scope

- In-app OneDrive / Google Drive upload (picker SDK + OAuth app registration) - not needed on Android, where the system picker already reaches both.
- Larger or full-length attachments after a paid Groq tier, or chunked summarisation.
- Removing cold starts entirely: keep-alive ping or a paid Render instance.

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
- [ ] Grep root `README.md`, `backend/README.md`, `frontend/README.md`, and `CLAUDE.md` for the same category of prose drift (superseded behavior, old credential/field/route names, removed env var names).
- [ ] For every *number* claimed in those same docs (test counts, file counts, anything quantitative) - actually run the command that produces it right now (`uv run pytest --collect-only -q` for backend, `npm run test -- --run` for frontend, count e2e `test(` blocks) and compare digit-for-digit against what's written. Do not substitute a text-pattern grep like `[0-9]+ tests?` for this - that exact substitution missed a real instance (README claimed "75 automated tests" with a 40/25/10 per-layer table, actually 113 with 66/37/10, because the digit and the word "tests" weren't adjacent enough for the grep to match).
- [ ] For every screenshot referenced by any doc - compare the commit date that last touched the image file against the most recent frontend commit touching what it depicts (copy, layout, visible behavior). Don't assume "no styling changes happened" without checking dates; a copy-only fix is enough to make a screenshot wrong. Caught for real: `docs/kanban-board-screenshot.png` was committed 11 days before the footer-copy fix it should have reflected, and still shows the old "Changes live in this session only" text baked into the image - the live app has said "Changes save automatically to your account" since `50e7473`.
- [ ] State the check's scope explicitly in the answer (what was actually grepped/run, not just "yes, up to date") - an unqualified "yes" is what turns a partial check into a false claim.

## Learnings

Non-obvious lessons from building and shipping this project, kept here so they inform future decisions instead of being re-learned.

**A grep for a text pattern is not the same claim as "I checked the number."** The Part 14 staleness audit ran `grep -rniE "[0-9]+ tests?" README.md` and found nothing, then reported "no drift found." The README actually said "75 automated tests" with a 40/25/10 per-layer table against a real count of 113 (66/37/10) - the regex missed it because the digit and the word "tests" weren't adjacent (`"75 automated tests"`, `"| 40 |"`). A grep for a pattern proves the pattern doesn't appear; it does not prove the underlying fact is current. Any numeric claim needs its source command re-run and compared, not a pattern search treated as a substitute.
**A screenshot is a claim that ages exactly like prose, but nothing greps an image.** `docs/kanban-board-screenshot.png` was committed 11 days before a footer-copy fix (`50e7473`) and still shows the pre-fix text baked into the pixels. Because there's no keyword to search for inside a PNG, this class of drift needs a different check entirely: compare the screenshot's last-commit date against the last commit touching whatever it depicts, every time - not "no styling changes were made recently" reasoning, which only covers layout, not copy.

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