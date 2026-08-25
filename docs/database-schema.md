# Kanban JSON Database Proposal

## Status

Approved for Part 5 and implemented in Parts 6 and 7. Future schema changes still require review and a versioned migration decision.

**Storage engine note:** this document describes the original JSON-file design approved for Part 5. The store was later migrated to SQLite (`backend/data/kanban.db`, WAL mode) - see `backend/app/repository.py` and `CLAUDE.md` for the authoritative current schema and write strategy. The relational shape below (users/boards/columns/cards linked by id) still matches; the "File and Write Strategy" section does not - SQLite replaces the JSON-file-plus-atomic-rename approach entirely. Part 11 (multi-board support, see `docs/PLAN.md`) additionally relaxed the "one board per user" rule described below to "one or more boards per user."

## Goals

- Keep the local database human-readable and easy to inspect.
- Support multiple users, each able to own one or more boards (see the Part 11 update in `docs/PLAN.md`).
- Preserve the MVP's five fixed columns and card-only content model.
- Make card movement and reordering explicit and deterministic.
- Avoid storing passwords; Part 4 credentials remain a client-only demo until a real authentication decision is made.

The machine-readable contract is [kanban-database.schema.json](kanban-database.schema.json), and a seeded instance is [kanban-database.example.json](kanban-database.example.json).

## Storage Shape

The database is one JSON object with five top-level collections:

- `schema_version`: integer migration version. The first version is `1`.
- `users`: user identity and the user's board reference.
- `boards`: board metadata and owner reference.
- `columns`: board columns, including display order and accent color.
- `cards`: cards, including their board, column, and position.

Relationships are represented by IDs:

- `boards.owner_id` references `users.id` (not unique - a user may own several boards).
- `columns.board_id` references `boards.id`.
- `cards.board_id` references `boards.id`.
- `cards.column_id` references `columns.id`.

The collections are intentionally normalized. The API can assemble the nested board response expected by the frontend without duplicating card data in multiple places.

## Example Record

```json
{
  "schema_version": 1,
  "users": [
    { "id": "demo-user", "username": "user", "board_id": "q3-product-launch" }
  ],
  "boards": [
    { "id": "q3-product-launch", "owner_id": "demo-user", "name": "Q3 product launch" }
  ],
  "columns": [
    {
      "id": "backlog",
      "board_id": "q3-product-launch",
      "name": "Backlog",
      "accent": "#8b95a5",
      "position": 0
    }
  ],
  "cards": [
    {
      "id": "map-user-journey",
      "board_id": "q3-product-launch",
      "column_id": "backlog",
      "title": "Map the user journey",
      "details": "Outline the key moments from first touch to activation.",
      "position": 0
    }
  ]
}
```

The complete seeded example is in the JSON example file.

## Identity and Ordering Rules

- IDs are stable lowercase kebab-case strings, unique within the whole database.
- `position` is a zero-based integer, unique among siblings.
- Columns are ordered by `position` within a board.
- Cards are ordered by `position` within a column.
- Moving a card changes its `column_id` and normalizes positions in both the source and destination columns.
- Reordering a card changes positions only within its column.
- API responses must sort columns and cards by position rather than relying on file order.
- The MVP contract requires exactly five columns per board. Empty columns are valid; a board with no cards is valid.
- Column IDs and card IDs are stable when names or titles are edited.

## Validation Rules

- Database `schema_version` must equal the supported version.
- All referenced IDs must exist and have the correct relationship.
- User, board, column, card, and position records must not be duplicated.
- A user owns one or more boards; deleting a user's only remaining board is rejected.
- A board must have exactly five columns with unique positions `0` through `4`.
- Column names are trimmed and 1 to 80 characters.
- Card titles are trimmed and 1 to 200 characters.
- Card details may be empty and are limited to 5,000 characters.
- Board names are trimmed and 1 to 120 characters.
- Accent colors must be six-digit hexadecimal values such as `#35b9ee`.
- Unknown fields are rejected rather than silently discarded.

## Empty and Initial State

If the database file does not exist, the backend creates its parent directory and writes the seeded instance from `kanban-database.example.json` atomically. A valid user or board with no cards remains an empty board with five columns; it is not reseeded.

Superseded: this originally described a fixed demo user (`demo-user` / username `user`) with no password mechanism, from before real accounts existed. Every signup now creates its own user row (bcrypt password hash) and seeds exactly one board for that user; additional boards are created on request (Part 11).

## File and Write Strategy

- Proposed path: `backend/data/kanban.json`.
- `backend/data/` is local application data and must not be committed.
- Reads parse and validate the complete document before returning data.
- Writes validate the complete new document first.
- Writes go to a same-directory temporary file, flush and close it, then replace the target with an atomic rename.
- A single-process write lock serializes updates. Multi-worker or multi-instance deployments are out of scope for the JSON store.
- The backend should expose a clear error if the data directory is not writable.

## Corruption and Recovery

The backend must fail closed when JSON parsing or schema validation fails. It must not overwrite a corrupt database with fresh seed data. The error should identify that local data is invalid and include the path without exposing secrets.

A future recovery command may copy the invalid file to a timestamped `.corrupt` artifact and restore from a known-good backup. Automatic recovery is not part of the first persistence implementation because silently discarding board changes is unsafe.

## Versioning and Migration

- Every future incompatible shape change increments `schema_version`.
- A migration function converts one complete version into the next and validates the result before writing it.
- Migrations run before repository reads return data.
- The original file is copied to a versioned backup before migration.
- Unsupported future versions are rejected; they are never downgraded automatically.
- Part 6 implements version `1` only unless a new requirement requires a migration.

## Review Decisions Required

These decisions were approved before Part 6:

1. Normalized top-level collections versus nested boards and cards.
2. One or more boards per user, each with exactly five columns (relaxed from "exactly one board per user" in Part 11 - see `docs/PLAN.md`).
3. `backend/data/kanban.json` as the local path (superseded by `backend/data/kanban.db`, SQLite - see the storage engine note above).
4. Atomic writes with single-process locking (implemented via SQLite WAL mode plus an in-process lock, not a JSON temp-file rename - see `backend/app/repository.py`).
5. Fail-closed corruption handling instead of automatic reseeding.
6. No password field in this JSON store (superseded - the SQLite `users` table stores a bcrypt password hash once real authentication was added).
