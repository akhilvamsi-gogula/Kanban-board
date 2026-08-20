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

- [ ] Add a root or service-level Dockerfile and `docker-compose.yml`/Compose configuration for the planned services.
- [ ] Define Docker, FastAPI, dependency, environment-variable, volume, and network conventions.
- [ ] Confirm the Codespaces Docker runtime and document a non-Docker fallback for frontend-only development.
- [ ] Add a minimal FastAPI health or hello-world endpoint.
- [ ] Add start and stop scripts under `scripts/` for the supported environment.
- [ ] Add a small example request from the static test page to the API.
- [ ] Document how to start, stop, and troubleshoot the services.

### Docker in GitHub Codespaces

Docker can generally be used in Codespaces, but installing the Docker CLI alone is not sufficient: a Docker daemon must also be available. The preferred implementation is to use the Codespace's supported Docker or Docker-in-Docker setup and verify it with `docker version` and `docker compose version` before relying on Compose.

Known limitations to account for in this plan:

- [ ] The Codespace may not have a running daemon, or the user may not have permission to access its socket.
- [ ] Docker-in-Docker may require privileged container support, which can be restricted by organization policy or the selected Codespaces configuration.
- [ ] Nested containers consume Codespaces CPU, memory, disk, and network quota; builds and Playwright runs may need resource tuning.
- [ ] Published ports must use Codespaces port forwarding, and service-to-service hostnames differ between the host and Compose network.
- [ ] Docker data and named volumes are not a substitute for durable production storage; Codespace recreation can remove local state.
- [ ] Secrets must be supplied through Codespaces secrets or environment configuration and must not be baked into images, logs, or Compose files.
- [ ] If Docker is unavailable, the FastAPI service must remain runnable directly with the documented Python command so development is not blocked.

### Tests and success criteria

- [ ] Backend unit test verifies the hello-world or health response.
- [ ] A local integration check verifies the static page can call the API.
- [ ] Start and stop scripts work without exposing secrets or requiring interactive input.
- [ ] Existing frontend tests and the MVP user experience remain unchanged.
- [ ] Docker and non-Docker startup paths both have documented validation steps.

## Part 3: Frontend MVP

The current MVP implementation is the target for this phase. Any changes require preserving the requirements below.

### Checklist

- [ ] Confirm the Next.js App Router frontend starts from `frontend/`.
- [ ] Display the `Kanban board` identity and one board at `/`.
- [ ] Render exactly five columns with seeded dummy cards.
- [ ] Allow columns to be renamed through their column action.
- [ ] Allow cards to be added, edited, and deleted with deletion confirmation.
- [ ] Support pointer and keyboard drag-and-drop between columns.
- [ ] Support reordering cards within a column.
- [ ] Keep state local and reset it on refresh.
- [ ] Keep the interface responsive and accessible without adding unrelated navigation or features.

### Tests and success criteria

- [ ] Unit/component tests cover rendering, card CRUD, delete confirmation, column renaming, and reordering.
- [ ] Keyboard interaction tests cover the drag-and-drop path or its supported equivalent.
- [ ] Playwright tests cover the core workflow at desktop and mobile widths.
- [ ] Lint, TypeScript, unit tests, production build, and end-to-end tests pass.
- [ ] The board is usable at narrow widths and no required content is clipped or overlapped.

## Part 4: Fake Sign-In Experience

This phase changes the first-load experience after the MVP and is explicitly a demo gate, not security.

### Checklist

- [ ] Agree that dummy credentials are acceptable and document the limitation.
- [ ] Show a sign-in screen before the board.
- [ ] Accept only username `user` and password `password`.
- [ ] Show an understandable validation error for invalid credentials.
- [ ] Allow a signed-in user to log out and return to the sign-in screen.
- [ ] Define whether refresh preserves or resets the demo session.

### Tests and success criteria

- [ ] Component tests cover valid, invalid, empty, and logout flows.
- [ ] Browser tests verify the board is inaccessible through the normal UI before sign-in.
- [ ] The demo limitation is documented and no real authentication claims are made.

## Part 5: JSON Database Model

This phase defines the persistence contract before persistence or API implementation. The schema must be reviewed and approved at its checkpoint.

### Checklist

- [ ] Define user, board, column, and card identifiers and relationships.
- [ ] Define ordering, rename behavior, validation rules, and empty-state behavior.
- [ ] Define the JSON file location, initialization behavior, and write strategy.
- [ ] Define concurrency, corruption recovery, and backup expectations for local development.
- [ ] Document the proposed schema and migration/versioning approach in `docs/`.
- [ ] Get user sign-off on the schema before implementation.

### Tests and success criteria

- [ ] Schema examples validate for seeded, empty, and multiple-user data.
- [ ] Invalid identifiers, duplicate ordering values, and malformed JSON have defined outcomes.
- [ ] The approved document is sufficient to implement the backend without guessing.

## Part 6: Backend Kanban API

This phase follows the approved Part 5 schema.

### Checklist

- [ ] Create the JSON database if it does not exist.
- [ ] Implement read and update routes scoped to a user.
- [ ] Validate request bodies and preserve the five-column MVP rules.
- [ ] Return consistent errors for missing users, boards, columns, and cards.
- [ ] Keep file access behind a small repository/service boundary.
- [ ] Document the API contract and local configuration.

### Tests and success criteria

- [ ] Backend unit tests cover initialization, reads, writes, validation, ordering, and malformed storage.
- [ ] API tests cover success and error responses, including user isolation.
- [ ] Tests run against an isolated temporary database and do not mutate development data.
- [ ] The API contract is documented and repeatable locally.

## Part 7: Persistent Frontend and Backend

This phase follows the tested Part 6 API.

### Checklist

- [ ] Replace local board reads and writes with API calls behind a typed client.
- [ ] Define loading, save failure, retry, and stale-data behavior.
- [ ] Preserve optimistic interaction only where rollback behavior is clear.
- [ ] Keep the existing board workflows and responsive UI intact.
- [ ] Document the required frontend and backend startup order.

### Tests and success criteria

- [ ] Component tests cover loading, successful saves, failures, retries, and rollback.
- [ ] Integration tests cover CRUD, renaming, and drag ordering through the API.
- [ ] Playwright tests verify persistence across reloads and useful error states.
- [ ] The frontend never silently loses a confirmed server-side update.

## Part 8: OpenRouter Connectivity

This phase requires an explicit checkpoint for credentials, cost controls, privacy, and network access before a live provider call.

### Checklist

- [ ] Approve OpenRouter as the provider and select a model.
- [ ] Define environment-variable names and ensure keys never reach the browser or repository.
- [ ] Define timeout, retry, rate-limit, and error-display behavior.
- [ ] Add a backend-only connectivity check using a simple `2+2` prompt.
- [ ] Document how to run the check without committing secrets.

### Tests and success criteria

- [ ] Unit tests mock the provider and cover success, timeout, malformed response, and provider errors.
- [ ] A manually authorized connectivity check confirms a valid response from OpenRouter.
- [ ] No test or log exposes the API key.

## Part 9: Structured Board-Aware AI

This phase follows the working provider integration and approved privacy and persistence decisions.

### Checklist

- [ ] Define the chat request containing board JSON, user question, and conversation history.
- [ ] Define the structured response containing assistant text and an optional validated board update.
- [ ] Define which board mutations the model may request and which remain impossible.
- [ ] Validate model output server-side before applying any update.
- [ ] Define history limits, prompt size limits, and behavior for rejected updates.
- [ ] Document privacy, retention, and cost implications.

### Tests and success criteria

- [ ] Unit tests cover valid responses, absent updates, malformed outputs, invalid board mutations, and history limits.
- [ ] Integration tests verify the board JSON and conversation history are passed correctly.
- [ ] Server-side validation prevents unauthorized or structurally invalid changes.
- [ ] The API returns a stable, documented structured contract.

## Part 10: AI Chat Sidebar

This phase follows the stable structured AI contract from Part 9.

### Checklist

- [ ] Add a responsive sidebar widget without obscuring core board actions.
- [ ] Support composing, submitting, viewing, and clearing chat history as designed.
- [ ] Show loading, error, and rejected-update states clearly.
- [ ] Apply an accepted board update and refresh the visible board automatically.
- [ ] Preserve keyboard accessibility and usable narrow-screen behavior.
- [ ] Keep AI features separate from the MVP path when the feature is unavailable.

### Tests and success criteria

- [ ] Component tests cover open, close, submit, loading, error, and board-update states.
- [ ] Integration tests verify structured AI updates are reflected in the board.
- [ ] Playwright tests cover the chat workflow on desktop and mobile.
- [ ] The core Kanban workflow remains usable when AI is closed, unavailable, or failing.

## Cross-Phase Completion Checks

- [ ] Update this document when requirements or architectural decisions change.
- [ ] Record user approvals before each phase with a new external dependency or data model.
- [ ] Keep tests close to the behavior they protect and avoid unrelated feature work.
- [ ] Run the relevant validation commands before declaring a phase complete.
- [ ] Do not commit secrets, generated test artifacts, or local database data.