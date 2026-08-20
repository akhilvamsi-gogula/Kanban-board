# Kanban Project

## Business Requirements

- An MVP of a Kanban style Project Management application as a web app
- The web app should only have 1 board
- The board has fixed 5 columns that can be renamed
- Each card has a title and details only
- Drag and drop interface to move cards between columns and reorder cards within a column
- Add, edit, and delete cards; deletion requires confirmation
- Rename columns through the column action
- No more functionality: no archive, no search/filter. Keep it simple.
- The priority is a slick, professional, gorgeous UI/UX with very simple features
- The app should open with dummy data populated for the single board

## Technical Details

- Implemented as a modern Next.js App Router app with TypeScript
- The NextJS app should be created in a subdirectory `frontend`
- The interactive board is client-only; board reads and writes use the FastAPI service after demo sign-in
- Refresh resets the demo sign-in state, while the backend JSON store retains board changes
- Demo sign-in uses `user` / `password`; it is not production authentication
- The optional AI co-pilot sends board context to OpenRouter only through the backend
- Uses dnd-kit for pointer and keyboard drag-and-drop
- Uses lucide-react for interface icons
- Uses Vitest and Testing Library for unit/component tests
- Uses Playwright for browser workflow and responsive tests
- Uses OpenRouter through a backend-only integration with `openai/gpt-oss-20b:free` by default
- As simple as possible but with an elegant UI

## Color Scheme

- Dark navy background: `#081525`
- Elevated navy lane: `#10253a`
- Card surface: `#172d44`
- Accent yellow: `#f5bd27` - primary actions and highlights
- Accent blue: `#35b9ee` - drag/drop states and emphasis
- Accent purple: `#b36ad0` - labels and secondary emphasis
- Supporting text: `#9caabd` and `#b1bfd0`

The interface is intentionally dark and board-first. Avoid generic hero copy, dates, decorative product claims, or unrelated navigation. The visible product identity is `Kanban board`.

## Strategy

1. Write plan with success criteria for each phase to be checked off. Include project scaffolding, including .gitignore, and rigorous unit testing.
2. Execute the plan ensuring all critiera are met
3. Carry out integration testing with Playwright or similar, fixing defects
4. Run lint, TypeScript, unit tests, and production build before completion
5. Only complete when the MVP is finished and tested, with the server running and ready for the user

## Validation Commands

Run from `frontend`:

```bash
npm run lint
npx tsc --noEmit
npm run test -- --run
npm run build
npm run test:e2e
```

Run backend checks from `backend`:

```bash
.venv/bin/python -m pytest -q
```

Playwright requires browser binaries and compatible system libraries. If browser launch fails with missing Linux libraries, report the environment limitation separately from application test failures.

## Coding standards

1. Use latest versions of libraries and idiomatic approaches as of today
2. Keep it simple - NEVER over-engineer, ALWAYS simplify, NO unnecessary defensive programming. No extra features - focus on simplicity.
3. Be concise. Keep README minimal. IMPORTANT: no emojis ever
