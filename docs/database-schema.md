# Database schema

The store is Postgres. The schema is the `SCHEMA` string in `backend/app/repository.py`, created on start-up with `CREATE TABLE IF NOT EXISTS`. There is no migration tool; a change to an existing table has to be applied to the live database by hand.

## Tables

| Table | Columns | Notes |
|---|---|---|
| `users` | `id` (PK), `username` (unique), `password_hash`, `created_at` | `password_hash` is bcrypt. Usernames are case-sensitive. |
| `boards` | `row_id` (serial), `id` (PK), `owner_id` (indexed), `name` | `row_id` only preserves creation order for the board list. A user may own many boards. |
| `columns` | `row_id` (PK), `id`, `board_id`, `name`, `accent`, `position` | `UNIQUE(board_id, id)`. Always five per board. |
| `cards` | `row_id` (PK), `id`, `board_id`, `column_id`, `title`, `details`, `position` | `UNIQUE(board_id, id)`. |
| `sessions` | `token_hash` (PK), `user_id`, `created_at`, `expires_at` | Only the SHA-256 hash of the session token is stored. Sessions last 7 days. |
| `password_resets` | `token_hash` (PK), `user_id`, `created_at`, `expires_at`, `used` | Hash only. Tokens last 30 minutes and work once. |
| `ai_chat_messages` | `row_id` (PK), `user_id` (indexed), `board_id`, `role`, `content`, `created_at` | Every AI prompt and reply, for analysis in SQL. Not exposed through the API. |

Ids are text (random hex for users and boards). Timestamps are ISO 8601 strings in UTC.

## Relationships

```
users 1 --- n boards 1 --- 5 columns 1 --- n cards
users 1 --- n sessions
users 1 --- n password_resets
```

Tables are linked by id, without foreign-key constraints. The repository keeps them consistent: deleting a board deletes its columns and cards in the same transaction.

## Rules to keep in mind

- **Column and card ids are unique only within a board**, not across the database. Every new board has columns with the ids `backlog`, `up-next`, `in-progress`, `review` and `done`.
- **Every board query is scoped to its owner**: `WHERE id = %s AND owner_id = %s`.
- **`position`** is zero-based. Column positions are 0 to 4; card positions are contiguous within a column. Reads sort by position.
- **A save replaces the board**: `save_board` deletes the board's columns and cards and inserts the new set in one transaction.
- **Every account keeps at least one board.** Sign-up creates the first one, with five empty columns; deleting the last one is refused.
- **Validation** lives in `backend/app/models.py`, not in the database: lengths, id patterns, the five-column rule. A board is validated when saved and again when read.

## History

The first version stored one JSON file, then SQLite, before moving to Postgres so data survives the backend redeploying. The relational shape has stayed the same throughout. `docs/PLAN.md` has the record of each step.
