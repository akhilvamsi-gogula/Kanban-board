import hashlib
import secrets
import threading
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Iterator

import bcrypt
import psycopg
import psycopg.rows

from .models import BoardResponse, BoardSummary, BoardUpdate, CardModel, ColumnModel, UserResponse

SESSION_TTL = timedelta(days=7)
RESET_TOKEN_TTL = timedelta(minutes=30)
DEFAULT_BOARD_NAME = "My board"

DEFAULT_COLUMNS = [
    {"id": "backlog", "name": "Backlog", "accent": "#8b95a5"},
    {"id": "up-next", "name": "Up next", "accent": "#ecad0a"},
    {"id": "in-progress", "name": "In progress", "accent": "#209dd7"},
    {"id": "review", "name": "Review", "accent": "#753991"},
    {"id": "done", "name": "Done", "accent": "#2f9d70"},
]

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS boards (
  row_id BIGSERIAL,
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_boards_owner_id ON boards (owner_id);
CREATE TABLE IF NOT EXISTS columns (
  row_id BIGSERIAL PRIMARY KEY,
  id TEXT NOT NULL,
  board_id TEXT NOT NULL,
  name TEXT NOT NULL,
  accent TEXT NOT NULL,
  position INTEGER NOT NULL,
  UNIQUE(board_id, id)
);
CREATE TABLE IF NOT EXISTS cards (
  row_id BIGSERIAL PRIMARY KEY,
  id TEXT NOT NULL,
  board_id TEXT NOT NULL,
  column_id TEXT NOT NULL,
  title TEXT NOT NULL,
  details TEXT NOT NULL,
  position INTEGER NOT NULL,
  UNIQUE(board_id, id)
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE
);
"""


class DataStoreError(Exception):
    pass


class UsernameTakenError(Exception):
    pass


class BoardNotFoundError(Exception):
    pass


class CannotDeleteLastBoardError(Exception):
    pass


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _isoformat(moment: datetime) -> str:
    return moment.isoformat()


def _parse(moment: str) -> datetime:
    return datetime.fromisoformat(moment)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _hash_password(password: str) -> str:
    # bcrypt only considers the first 72 bytes of input; truncate explicitly
    # so passwords within our Pydantic length bound never raise inside bcrypt.
    return bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt()).decode("utf-8")


def _verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8")[:72], password_hash.encode("utf-8"))
    except ValueError:
        return False


@contextmanager
def _write(conn: psycopg.Connection) -> Iterator[None]:
    try:
        yield
        conn.commit()
    except psycopg.Error as error:
        conn.rollback()
        raise DataStoreError("Kanban database is not writable") from error


def _insert_board(conn: psycopg.Connection, board_id: str, owner_id: str, name: str) -> None:
    conn.execute("INSERT INTO boards (id, owner_id, name) VALUES (%s, %s, %s)", (board_id, owner_id, name))
    for position, column in enumerate(DEFAULT_COLUMNS):
        conn.execute(
            "INSERT INTO columns (id, board_id, name, accent, position) VALUES (%s, %s, %s, %s, %s)",
            (column["id"], board_id, column["name"], column["accent"], position),
        )


def _require_board(conn: psycopg.Connection, user_id: str, board_id: str) -> dict:
    board = conn.execute(
        "SELECT id, owner_id, name FROM boards WHERE id = %s AND owner_id = %s", (board_id, user_id)
    ).fetchone()
    if board is None:
        raise BoardNotFoundError("Board not found")
    return board


class KanbanRepository:
    def __init__(self, database_url: str) -> None:
        self.database_url = database_url
        self._lock = threading.RLock()
        with self._conn() as conn:
            conn.execute(SCHEMA)
            conn.commit()

    @contextmanager
    def _conn(self) -> Iterator[psycopg.Connection]:
        with self._lock:
            try:
                conn = psycopg.connect(self.database_url, row_factory=psycopg.rows.dict_row)
            except psycopg.Error as error:
                raise DataStoreError("Kanban database is not writable") from error
            try:
                yield conn
            except psycopg.Error as error:
                raise DataStoreError("Kanban database is unreadable") from error
            finally:
                conn.close()

    # -- users / auth -----------------------------------------------------

    def create_user(self, username: str, password: str) -> UserResponse:
        user_id = secrets.token_hex(16)
        board_id = secrets.token_hex(16)
        password_hash = _hash_password(password)
        with self._conn() as conn:
            try:
                conn.execute(
                    "INSERT INTO users (id, username, password_hash, created_at) VALUES (%s, %s, %s, %s)",
                    (user_id, username, password_hash, _isoformat(_now())),
                )
                _insert_board(conn, board_id, user_id, DEFAULT_BOARD_NAME)
                conn.commit()
            except psycopg.errors.UniqueViolation as error:
                conn.rollback()
                raise UsernameTakenError("Username is already taken") from error
            except psycopg.Error as error:
                conn.rollback()
                raise DataStoreError("Kanban database is not writable") from error
        return UserResponse(id=user_id, username=username)

    def authenticate_user(self, username: str, password: str) -> UserResponse | None:
        with self._conn() as conn:
            row = conn.execute("SELECT id, username, password_hash FROM users WHERE username = %s", (username,)).fetchone()
        if row is None or not _verify_password(password, row["password_hash"]):
            return None
        return UserResponse(id=row["id"], username=row["username"])

    def get_user(self, user_id: str) -> UserResponse | None:
        with self._conn() as conn:
            row = conn.execute("SELECT id, username FROM users WHERE id = %s", (user_id,)).fetchone()
        if row is None:
            return None
        return UserResponse(id=row["id"], username=row["username"])

    # -- sessions -----------------------------------------------------------

    def create_session(self, user_id: str) -> str:
        token = secrets.token_urlsafe(32)
        now = _now()
        with self._conn() as conn:
            conn.execute(
                "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (%s, %s, %s, %s)",
                (hash_token(token), user_id, _isoformat(now), _isoformat(now + SESSION_TTL)),
            )
            conn.commit()
        return token

    def get_user_by_session(self, token: str) -> UserResponse | None:
        token_hash = hash_token(token)
        with self._conn() as conn:
            row = conn.execute(
                "SELECT user_id, expires_at FROM sessions WHERE token_hash = %s", (token_hash,)
            ).fetchone()
            if row is None:
                return None
            if _parse(row["expires_at"]) < _now():
                conn.execute("DELETE FROM sessions WHERE token_hash = %s", (token_hash,))
                conn.commit()
                return None
            user_row = conn.execute("SELECT id, username FROM users WHERE id = %s", (row["user_id"],)).fetchone()
        if user_row is None:
            return None
        return UserResponse(id=user_row["id"], username=user_row["username"])

    def delete_session(self, token: str) -> None:
        with self._conn() as conn:
            conn.execute("DELETE FROM sessions WHERE token_hash = %s", (hash_token(token),))
            conn.commit()

    def _delete_all_sessions_for_user(self, conn: psycopg.Connection, user_id: str) -> None:
        conn.execute("DELETE FROM sessions WHERE user_id = %s", (user_id,))

    # -- password reset -------------------------------------------------------

    def create_password_reset(self, username: str) -> str | None:
        with self._conn() as conn:
            row = conn.execute("SELECT id FROM users WHERE username = %s", (username,)).fetchone()
            if row is None:
                return None
            token = secrets.token_urlsafe(32)
            now = _now()
            conn.execute(
                "INSERT INTO password_resets (token_hash, user_id, created_at, expires_at, used) VALUES (%s, %s, %s, %s, FALSE)",
                (hash_token(token), row["id"], _isoformat(now), _isoformat(now + RESET_TOKEN_TTL)),
            )
            conn.commit()
        return token

    def reset_password(self, token: str, new_password: str) -> bool:
        token_hash = hash_token(token)
        with self._conn() as conn:
            row = conn.execute(
                "SELECT user_id, expires_at, used FROM password_resets WHERE token_hash = %s", (token_hash,)
            ).fetchone()
            if row is None or row["used"] or _parse(row["expires_at"]) < _now():
                return False
            conn.execute(
                "UPDATE users SET password_hash = %s WHERE id = %s",
                (_hash_password(new_password), row["user_id"]),
            )
            conn.execute("UPDATE password_resets SET used = TRUE WHERE token_hash = %s", (token_hash,))
            self._delete_all_sessions_for_user(conn, row["user_id"])
            conn.commit()
        return True

    # -- boards ----------------------------------------------------------------

    def list_boards(self, user_id: str) -> list[BoardSummary]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT id, name FROM boards WHERE owner_id = %s ORDER BY row_id", (user_id,)
            ).fetchall()
        return [BoardSummary(id=row["id"], name=row["name"]) for row in rows]

    def create_board(self, user_id: str, name: str) -> BoardResponse:
        board_id = secrets.token_hex(16)
        with self._conn() as conn, _write(conn):
            _insert_board(conn, board_id, user_id, name)
        return self.get_board(user_id, board_id)

    def rename_board(self, user_id: str, board_id: str, name: str) -> BoardResponse:
        with self._conn() as conn:
            _require_board(conn, user_id, board_id)
            with _write(conn):
                conn.execute("UPDATE boards SET name = %s WHERE id = %s", (name, board_id))
        return self.get_board(user_id, board_id)

    def get_board(self, user_id: str, board_id: str) -> BoardResponse:
        with self._conn() as conn:
            board = _require_board(conn, user_id, board_id)
            column_rows = conn.execute(
                "SELECT id, name, accent, position FROM columns WHERE board_id = %s ORDER BY position", (board_id,)
            ).fetchall()
            card_rows = conn.execute(
                "SELECT id, column_id, title, details, position FROM cards WHERE board_id = %s ORDER BY position",
                (board_id,),
            ).fetchall()
        try:
            columns = [
                ColumnModel(
                    id=column["id"],
                    name=column["name"],
                    accent=column["accent"],
                    position=column["position"],
                    cards=[
                        CardModel(id=card["id"], title=card["title"], details=card["details"], position=card["position"])
                        for card in card_rows
                        if card["column_id"] == column["id"]
                    ],
                )
                for column in column_rows
            ]
            board_update = BoardUpdate(name=board["name"], columns=columns)
        except (KeyError, TypeError, ValueError) as error:
            raise DataStoreError("Kanban database structure is invalid") from error
        return BoardResponse(id=board["id"], owner_id=board["owner_id"], name=board_update.name, columns=board_update.columns)

    def save_board(self, user_id: str, board_id: str, board: BoardUpdate) -> BoardResponse:
        with self._conn() as conn:
            _require_board(conn, user_id, board_id)
            with _write(conn):
                conn.execute("UPDATE boards SET name = %s WHERE id = %s", (board.name, board_id))
                conn.execute("DELETE FROM columns WHERE board_id = %s", (board_id,))
                conn.execute("DELETE FROM cards WHERE board_id = %s", (board_id,))
                for column in board.columns:
                    conn.execute(
                        "INSERT INTO columns (id, board_id, name, accent, position) VALUES (%s, %s, %s, %s, %s)",
                        (column.id, board_id, column.name, column.accent, column.position),
                    )
                    for card in column.cards:
                        conn.execute(
                            "INSERT INTO cards (id, board_id, column_id, title, details, position) VALUES (%s, %s, %s, %s, %s, %s)",
                            (card.id, board_id, column.id, card.title, card.details, card.position),
                        )
        return self.get_board(user_id, board_id)

    def delete_board(self, user_id: str, board_id: str) -> None:
        with self._conn() as conn:
            _require_board(conn, user_id, board_id)
            board_count = conn.execute("SELECT COUNT(*) AS n FROM boards WHERE owner_id = %s", (user_id,)).fetchone()["n"]
            if board_count <= 1:
                raise CannotDeleteLastBoardError("Cannot delete your only board")
            with _write(conn):
                conn.execute("DELETE FROM cards WHERE board_id = %s", (board_id,))
                conn.execute("DELETE FROM columns WHERE board_id = %s", (board_id,))
                conn.execute("DELETE FROM boards WHERE id = %s", (board_id,))
