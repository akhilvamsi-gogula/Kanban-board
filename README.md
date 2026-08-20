# Kanban-board

A client-rendered Kanban MVP built with Next.js in `frontend`.

![Kanban board preview](docs/kanban-board-preview.svg)

## Features

- One board with five fixed, renameable columns
- Seeded dummy cards on initial load
- Add, edit, delete, and drag cards
- Reorder cards within a column
- Responsive dark interface
- In-memory state only; refresh resets the board

## What Was Done

- Scaffolded a Next.js App Router project with TypeScript and Tailwind CSS.
- Added dnd-kit for pointer and keyboard drag-and-drop interactions.
- Built reusable board, column, card, and dialog components.
- Added seeded data and typed domain models for cards and columns.
- Implemented card creation, editing, deletion confirmation, column renaming, and card reordering.
- Designed a responsive dark UI with accessible labels, focus states, drag feedback, and mobile overflow handling.
- Fixed a dnd-kit server/client hydration mismatch by loading the interactive board client-side.
- Added Vitest and Testing Library coverage for core board interactions.
- Added Playwright scenarios for browser workflows and responsive behavior.
- Added linting, type checking, production build scripts, and GitHub-ready ignore rules.

## AI Skills Demonstrated

This repository demonstrates practical AI-assisted engineering through:

- Requirement analysis and clarification before implementation.
- Planning a project in phases with explicit acceptance checks.
- Choosing appropriate libraries instead of over-engineering core behavior.
- Designing typed React state and reusable component boundaries.
- Building accessible interactions, including keyboard drag-and-drop.
- Debugging hydration, selector, CSS, and type-checking failures from actual output.
- Writing focused unit tests and end-to-end browser tests.
- Validating with lint, TypeScript, tests, and production builds.
- Reviewing Git changes, keeping generated artifacts ignored, and pushing clean commits.

## Run Locally

Requires Node.js 20 or later.

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000.

## Run the Part 2 backend

The FastAPI smoke-test service can run directly with Python or through Docker Compose.

```bash
./scripts/start.sh
```

Open http://localhost:8000/ and confirm the page reports the API response. Stop it with:

```bash
./scripts/stop.sh
```

For a direct run without Docker, see [backend/README.md](backend/README.md). In Codespaces, forward port 8000 to access the backend page from a browser.

## Validate

```bash
npm run lint
npm run test -- --run
npm run build
npm run test:e2e
```

Backend tests:

```bash
cd backend
.venv/bin/python -m pytest
```

Playwright tests require its browser binaries and supported system libraries.
