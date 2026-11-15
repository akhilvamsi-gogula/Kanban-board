# Frontend

The Next.js app for the Kanban board. See the [root README](../README.md) for the project overview and quick start.

```bash
npm install
npm run dev          # http://localhost:3000
```

The dev server rewrites `/backend-api/*` to the backend's `/api/*` (`next.config.ts`). The backend defaults to `http://127.0.0.1:8000`; set `KANBAN_BACKEND_URL` to point elsewhere.

```bash
npm run lint
npx tsc --noEmit
npm run test -- --run     # Vitest, tests in tests/
npm run build
npm run test:e2e          # Playwright, tests in e2e/, four device profiles
```

Layout: `app/page.tsx` (start-up, session, saving), `components/` (board, cards, dialogs, AI panel, sign-in), `lib/api.ts` (backend calls), `lib/board-ops.ts` (pure board operations). Details are in [docs/architecture.md](../docs/architecture.md) and [docs/testing.md](../docs/testing.md).
