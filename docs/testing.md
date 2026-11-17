# Testing

How the app is tested, on which devices, what the edge and boundary cases are, and how to run everything.

## Summary

| Layer | Tool | Count | Runs in CI |
|---|---|---|---|
| Backend unit and integration | pytest against a real Postgres | 145 tests | yes |
| Frontend unit and component | Vitest + Testing Library (jsdom) | 79 tests in 6 files | yes |
| End-to-end | Playwright, real browsers against a real backend and database | 13 scenarios x 4 device profiles = 52 runs (48 run, 4 skipped by design) | no |
| Load (concurrent users) | `backend/scripts/load_check.py` | 5 and 25 simultaneous users | no |
| AI behavior | `backend/eval/ai_eval.py` against the real Groq model | 10 cases | no |
| Real device | manual, Galaxy S24 Ultra | checklist below | no |

CI (`.github/workflows/ci.yml`) runs the backend suite against a Postgres service container, plus frontend lint, type check, Vitest and build, on every pull request and every push to `main`. Playwright, the load check and the AI eval are run by hand: they need browser binaries, a running backend and database, or Groq quota.

## Device matrix

Playwright projects are defined in `frontend/playwright.config.ts`. Every scenario runs on every profile unless noted.

| Profile | Engine | Viewport (CSS px) | Input | How it is covered |
|---|---|---|---|---|
| `desktop` | Chromium (Desktop Chrome) | 1280 x 720 | mouse, keyboard | Playwright |
| `iphone-13` | WebKit (the Safari engine) | 390 x 664 | touch | Playwright emulation |
| `pixel-7` | Chromium | 412 x 839 | touch | Playwright emulation |
| `galaxy-s24-ultra` | Chromium | 384 x 824, pixel ratio 3.75 | touch | Playwright emulation, plus manual checks on the real phone |

Notes for testers:

- The Galaxy S24 Ultra is the narrowest of the three phones, so layout problems show there first. Playwright has no built-in profile for it; the project uses the phone's real viewport and pixel ratio.
- Emulation uses the desktop browser engine at phone size with touch enabled. It does not reproduce a phone browser's own toolbars. The AI panel bug (Samsung Internet's bottom toolbar covering the text box) was only visible on the real phone, which is why the real-device checklist exists.
- The touch drag test sends real touch input through Chromium's DevTools protocol (`Input.dispatchTouchEvent`), so the browser's own scroll and gesture handling is exercised. Playwright cannot script real touch input in WebKit, so that one scenario is skipped on `iphone-13`. Touch drag on iOS is therefore not covered by automation and has not yet been checked on a real iPhone.
- The 4 skipped runs: touch drag on `iphone-13` (above), and "hides the column chips on a desktop screen" on the three phone profiles (it is a desktop-only check).

### End-to-end scenarios (`frontend/e2e/kanban.spec.ts`)

1. Drag cards within a column and across columns (mouse on desktop, real touch on the Android profiles), and the result survives a reload.
2. Core workflow: sign up, add, edit and delete a card, rename a column, reload.
3. Create several boards, switch between them, and check their cards stay separate.
4. Rename a board, and re-select the active board without getting stuck loading.
5. The board stays usable on a narrow (700 px) viewport.
6. On a phone screen, a column chip brings the Done column into view, and the AI text box and Send button are on screen.
7. At 901, 980, 1024 and 1200 px wide (a tablet, a narrow window, a phone browser in "Desktop site" mode), a column chip brings the Done column into view. Five columns need about 1270 px; below that the board scrolls sideways and the chips appear. These count as four scenarios.
8. Maximum-length text (200-character title, 80-character column name, 120-character board name, a long URL) stays inside its box on a phone screen and survives a reload.
9. The column chips are hidden on a desktop screen (1280 px and wider).
10. The board requires sign-in, and logging out returns to sign-in.

### Real-device checklist (Galaxy S24 Ultra)

Confirmed on the real phone: drag and drop by the six-dot grip, the Done column reachable through the column chips, and the AI text box visible without scrolling. Repeat after any change to `globals.css`, the drag sensors in `components/board.tsx`, or the AI panel:

1. Sign in. The username field must not capitalise the first letter.
2. Press and hold a card's grip for a moment, drag it within its column, then to another column. Hold it at the screen edge: the board scrolls sideways.
3. Swipe the board sideways. It stops on a whole column.
4. Tap each column chip. The board jumps to that column.
5. Open the AI co-pilot. The text box and Send are visible without scrolling, with the on-screen keyboard open and closed.
6. Add a card with a very long word in the title. It wraps inside the card.
7. Rotate the phone to landscape and repeat steps 2 and 5.
8. Turn on the browser's "Desktop site" option. The chips still show and Done is reachable.
9. In the AI co-pilot tap Attach. The system picker offers files, the camera and cloud drives. Attach a document and a photo, ask for cards, then type "undo".

## Edge and boundary cases

Limits are defined once, in `backend/app/models.py`; the inputs in the UI carry the same `maxLength`.

| Field | Rule | At the limit | Past the limit |
|---|---|---|---|
| Username | 3-32 characters: letters, digits, `-`, `_`; case-sensitive | 3 and 32 accepted | 2 and 33 rejected (422); the sign-up form names the problem before sending |
| Password | 8-128 characters | 8 and 128 accepted | 7 and 129 rejected (422) |
| Card title | 1-200 characters after trimming | 200 accepted | 201 rejected (422); the input stops at 200 |
| Card details | 0-5,000 characters | 5,000 accepted | 5,001 rejected (422) |
| Column name | 1-80 characters after trimming | 80 accepted | 81 rejected (422) |
| Board name | 1-120 characters after trimming | 120 accepted | 121 rejected (422) |
| AI prompt | 1-2,000 characters after trimming | | rejected (422) |
| Columns per board | exactly 5, positions 0-4, unique ids | | 4 or 6 columns rejected (422) |
| Card positions | contiguous from 0 within a column | | a gap or duplicate rejected (422) |
| Card and column ids | `^[a-z][a-z0-9-]{0,63}$`, unique within a board | | rejected (422) |
| Boards per account | at least 1 | | deleting the last board returns 409 |
| Attached file size | up to 4 MB | exactly 4 MB accepted | one byte over returns 413; an over-size `Content-Length` is refused before the body is read |
| Attachments per message | up to 3 | 3 accepted | a 4th is refused in the UI and by the API (422) |
| Attachment text | 10,000 characters per message, shared between its files | | longer text is cut and marked as shortened |

Other cases with tests:

- **Blank text.** A title, column name or board name that is empty or only whitespace is rejected (422), and the board stays readable. Text is trimmed before its length is checked.
- **Null character** in any text is rejected (422). Postgres cannot store it.
- **Unicode and markup.** Non-Latin text is stored unchanged. HTML and SQL-looking text is stored as a literal string and rendered as text.
- **Other people's data.** A board id that belongs to another account returns 404, the same as one that does not exist, on read, save, rename, delete and AI chat.
- **Sessions.** Requests without a session return 401. An expired session is rejected. A password reset signs out every session of that account. In the UI, a 401 during use returns to sign-in with "Your session has ended".
- **Password reset tokens.** A token works once; expired, reused and unknown tokens return 400. An unknown username gets the same response as a known one.
- **Concurrent saves.** The UI sends one save at a time and keeps only the newest state, so an older response never overwrites a newer edit. Sixteen simultaneous saves of one board (two tabs or devices) all succeed and leave a valid board.
- **Concurrent deletes.** Two simultaneous deletes of an account's last two boards: one succeeds, one returns 409, one board remains.
- **Attachments.** Each supported format (PDF, DOCX, XLSX, PPTX, text, image) is parsed from a file generated in the test. Rejected with a clear 422: an unsupported type, contents that do not match the extension, a password-protected PDF, a PDF with no text, a damaged Office file, a binary file with a text extension, an empty file, an Office file that unpacks to more than 50 MB. A path in the file name is stripped. The vision call for images is mocked; a retired vision model gives "Image reading is unavailable", and an empty `GROQ_VISION_MODEL` turns image reading off. Upload requires a session and counts toward the AI limit. Only attachment names are logged. In the UI: a file is sent with one message and then cleared; a failed file is left out; a file removed while still being read never comes back; a 4th file is refused.
- **Prompt injection through a file.** The chat request puts file text before the board and the user's request last; a backend test checks that order, and the AI eval's `attachment_spec_to_cards` case checks the real model does not follow an instruction planted in a file.
- **Rate limits.** Sign-up, login and password reset: 20 requests per minute per IP, with the window expiring correctly. AI: 10 requests per minute per account, not shared between accounts.
- **Failed save.** The board rolls back to its previous state and shows a Retry banner.
- **Switching boards mid-save.** A slow save for the previous board does not overwrite the board now on screen.
- **AI replies.** Malformed JSON, a claimed change with no `board_update`, a wrong field name, a partial update, an update that names an unknown column, a Groq timeout and a Groq 429 each have a test. All AI tests mock the Groq HTTP call, so they are fast, free and deterministic.
- **AI guardrails.** Each kind of change in the change list; a no-op update dropped, and retried if the reply claims a change; a card id in a reply retried, then replaced by the title. In the UI: the change list; a removal waiting for Apply; Discard; Apply refused after a manual edit; undo after Apply.
- **Cold start.** The wake-up screen stays hidden for a fast backend, appears after 2 seconds for a slow one, and shows an error with Try again after 90 seconds.
- **Long text on a phone.** See end-to-end scenario 8.
- **In-between widths.** See end-to-end scenario 7.

Known and accepted behavior:

- Usernames are case-sensitive: `Sam` and `sam` are two accounts. The form turns off auto-capitalisation so a phone keyboard does not create the difference by accident.
- bcrypt reads only the first 72 bytes of a password. Two passwords that share their first 72 bytes are treated as the same.
- Two tabs editing the same board: the last save wins. There is no live sync between tabs.
- A file is read with one message only. A follow-up question about it needs the file attached again; the panel says so.
- Photos straight from a phone camera are often larger than 4 MB and are refused with "Larger than 4 MB". The limit comes from the hosting proxy's request size cap.

## Load test: concurrent users

`backend/scripts/load_check.py` simulates N people using the app at the same moment, each with their own account. Every simulated user signs up, lists boards, loads a board, saves it five times (adding a card each time) and reloads it. The script then checks that each user sees exactly their own cards and nobody else's, and prints latency percentiles.

```bash
cd backend
KANBAN_AUTH_RATE_LIMIT=1000 DATABASE_URL=postgresql://kanban:kanban@localhost:5432/kanban uv run uvicorn app.main:app --port 8000
uv run python scripts/load_check.py --users 25        # in a second terminal
```

Results on a development laptop against a local Postgres (2026-11-15):

| Users | Wall time | Save p50 / p95 | Board load p95 | Sign-up p95 | Isolation |
|---|---|---|---|---|---|
| 5 | 1.2 s | 46 / 54 ms | 40 ms | 662 ms | ok |
| 25 | 3.5 s | 180 / 233 ms | 211 ms | 1,698 ms | ok |

Before the connection pool (one global lock, a new database connection per call) the 25-user run took 21 seconds. Sign-up is the slowest request on purpose: bcrypt hashing is CPU-heavy, which is what makes stolen password hashes expensive to crack.

Limits of this test: it runs on one machine against a local database. The deployed app runs on Render's free instance (a fraction of a CPU) and a Neon database over the network, so absolute times there are higher. The load check has not been run against production, because it creates real accounts.

The AI co-pilot is not part of the load check. One Groq key serves every user (8,000 tokens per minute and 1,000 requests per day on the free tier), so several people using the AI in the same minute will see "The AI is busy right now". See [deployment.md](deployment.md).

## Running the tests

Backend tests need Postgres on `localhost:5432` (`docker compose up -d postgres` from the repository root). They use a separate `kanban_test` database, created automatically, because every test empties all tables. Override it with `TEST_DATABASE_URL`.

```bash
cd backend
uv run pytest -q                                   # all 145
uv run pytest -q tests/test_main.py::test_name     # one test

cd frontend
npm run lint
npx tsc --noEmit
npm run test -- --run                              # all 75
npm run test -- --run tests/board.test.tsx         # one file
npm run build
npm run test:e2e                                   # all 4 device profiles
npx playwright test --project=galaxy-s24-ultra     # one profile
```

Playwright starts the frontend and backend itself if they are not running. A backend you started yourself must have `KANBAN_AUTH_RATE_LIMIT=1000`, because every test signs up from the same IP.

AI behavior against the real model (uses Groq quota, results vary run to run): `cd backend && uv run python eval/ai_eval.py`. See [`backend/eval/README.md`](../backend/eval/README.md) for what it covers and when to run it.
