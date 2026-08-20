import json
import os
import threading
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any

from .models import BoardResponse, BoardUpdate, CardModel, ColumnModel

SCHEMA_VERSION = 1
DEFAULT_DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "kanban.json"

SEED_DATA: dict[str, Any] = {
    "schema_version": SCHEMA_VERSION,
    "users": [{"id": "demo-user", "username": "user", "board_id": "q3-product-launch"}],
    "boards": [{"id": "q3-product-launch", "owner_id": "demo-user", "name": "Q3 product launch"}],
    "columns": [
        {"id": "backlog", "board_id": "q3-product-launch", "name": "Backlog", "accent": "#8b95a5", "position": 0},
        {"id": "up-next", "board_id": "q3-product-launch", "name": "Up next", "accent": "#ecad0a", "position": 1},
        {"id": "in-progress", "board_id": "q3-product-launch", "name": "In progress", "accent": "#209dd7", "position": 2},
        {"id": "review", "board_id": "q3-product-launch", "name": "Review", "accent": "#753991", "position": 3},
        {"id": "done", "board_id": "q3-product-launch", "name": "Done", "accent": "#2f9d70", "position": 4},
    ],
    "cards": [
        {"id": "map-user-journey", "board_id": "q3-product-launch", "column_id": "backlog", "title": "Map the user journey", "details": "Outline the key moments from first touch to activation.", "position": 0},
        {"id": "review-analytics", "board_id": "q3-product-launch", "column_id": "backlog", "title": "Review product analytics", "details": "Pull the top friction points from the latest monthly report.", "position": 1},
        {"id": "write-brief", "board_id": "q3-product-launch", "column_id": "up-next", "title": "Write the launch brief", "details": "Capture the audience, message, channels, and success signals.", "position": 0},
        {"id": "audit-content", "board_id": "q3-product-launch", "column_id": "up-next", "title": "Audit existing content", "details": "Gather the strongest proof points and retire anything stale.", "position": 1},
        {"id": "design-system", "board_id": "q3-product-launch", "column_id": "in-progress", "title": "Shape the design system", "details": "Turn the visual direction into reusable UI patterns.", "position": 0},
        {"id": "prototype-flow", "board_id": "q3-product-launch", "column_id": "in-progress", "title": "Prototype the core flow", "details": "Make the happy path tangible enough for an early review.", "position": 1},
        {"id": "qa-release", "board_id": "q3-product-launch", "column_id": "review", "title": "QA the release candidate", "details": "Check the critical paths on desktop, tablet, and mobile.", "position": 0},
        {"id": "team-alignment", "board_id": "q3-product-launch", "column_id": "done", "title": "Align with the team", "details": "Share the direction and agree on the next meaningful milestone.", "position": 0},
    ],
}


class DataStoreError(Exception):
    pass


class KanbanRepository:
    def __init__(self, path: Path = DEFAULT_DATA_PATH) -> None:
        self.path = path
        self._lock = threading.RLock()

    def _read(self) -> dict[str, Any]:
        if not self.path.exists():
            self._write(SEED_DATA)
        try:
            with self.path.open(encoding="utf-8") as handle:
                data = json.load(handle)
        except (OSError, json.JSONDecodeError) as error:
            raise DataStoreError("Kanban database is unreadable") from error
        try:
            self._validate_data(data)
        except (KeyError, TypeError, ValueError) as error:
            raise DataStoreError("Kanban database structure is invalid") from error
        return data

    @staticmethod
    def _validate_data(data: dict[str, Any]) -> None:
        if data.get("schema_version") != SCHEMA_VERSION:
            raise ValueError("unsupported schema version")
        if set(data) != {"schema_version", "users", "boards", "columns", "cards"}:
            raise ValueError("unexpected database fields")
        if not all(isinstance(data[key], list) for key in ("users", "boards", "columns", "cards")):
            raise TypeError("collections must be lists")

        users = {item["id"]: item for item in data["users"]}
        boards = {item["id"]: item for item in data["boards"]}
        columns = {item["id"]: item for item in data["columns"]}
        cards = {item["id"]: item for item in data["cards"]}
        collections = (users, boards, columns, cards)
        if any(len(collection) != len(items) for collection, items in zip(collections, (data["users"], data["boards"], data["columns"], data["cards"]))):
            raise ValueError("duplicate IDs")
        if len(set().union(*[set(collection) for collection in collections])) != sum(len(collection) for collection in collections):
            raise ValueError("IDs must be unique across collections")

        for user in users.values():
            if set(user) != {"id", "username", "board_id"} or user["board_id"] not in boards:
                raise ValueError("invalid user relationship")
        for board in boards.values():
            if set(board) != {"id", "owner_id", "name"} or board["owner_id"] not in users:
                raise ValueError("invalid board relationship")
        for column in columns.values():
            if set(column) != {"id", "board_id", "name", "accent", "position"} or column["board_id"] not in boards:
                raise ValueError("invalid column relationship")
        for card in cards.values():
            if set(card) != {"id", "board_id", "column_id", "title", "details", "position"} or card["board_id"] not in boards or card["column_id"] not in columns:
                raise ValueError("invalid card relationship")

        for board in boards.values():
            board_columns = [
                ColumnModel(
                    id=column["id"],
                    name=column["name"],
                    accent=column["accent"],
                    position=column["position"],
                    cards=[
                        CardModel(id=card["id"], title=card["title"], details=card["details"], position=card["position"])
                        for card in cards.values()
                        if card["board_id"] == board["id"] and card["column_id"] == column["id"]
                    ],
                )
                for column in columns.values()
                if column["board_id"] == board["id"]
            ]
            BoardUpdate(name=board["name"], columns=board_columns)

    def _write(self, data: dict[str, Any]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        try:
            with NamedTemporaryFile("w", encoding="utf-8", dir=self.path.parent, delete=False) as handle:
                json.dump(data, handle, indent=2)
                handle.write("\n")
                handle.flush()
                os.fsync(handle.fileno())
                temporary_path = Path(handle.name)
            temporary_path.replace(self.path)
        except OSError as error:
            raise DataStoreError("Kanban database is not writable") from error

    def get_board(self, user_id: str) -> BoardResponse | None:
        with self._lock:
            data = self._read()
        user = next((item for item in data["users"] if item["id"] == user_id), None)
        if user is None:
            return None
        board = next((item for item in data["boards"] if item["id"] == user["board_id"]), None)
        if board is None:
            raise DataStoreError("User board relationship is invalid")
        columns = [
            ColumnModel(
                id=column["id"],
                name=column["name"],
                accent=column["accent"],
                position=column["position"],
                cards=[
                    CardModel(
                        id=card["id"],
                        title=card["title"],
                        details=card["details"],
                        position=card["position"],
                    )
                    for card in data["cards"]
                    if card["board_id"] == board["id"] and card["column_id"] == column["id"]
                ],
            )
            for column in sorted(data["columns"], key=lambda item: item["position"])
            if column["board_id"] == board["id"]
        ]
        return BoardResponse(id=board["id"], owner_id=board["owner_id"], name=board["name"], columns=columns)

    def save_board(self, user_id: str, board: BoardUpdate) -> BoardResponse | None:
        with self._lock:
            data = self._read()
            user = next((item for item in data["users"] if item["id"] == user_id), None)
            if user is None:
                return None
            board_record = next((item for item in data["boards"] if item["id"] == user["board_id"]), None)
            if board_record is None:
                raise DataStoreError("User board relationship is invalid")
            board_record["name"] = board.name
            data["columns"] = [item for item in data["columns"] if item["board_id"] != board_record["id"]]
            data["cards"] = [item for item in data["cards"] if item["board_id"] != board_record["id"]]
            for column in board.columns:
                data["columns"].append({"id": column.id, "board_id": board_record["id"], "name": column.name, "accent": column.accent, "position": column.position})
                for card in column.cards:
                    data["cards"].append({"id": card.id, "board_id": board_record["id"], "column_id": column.id, "title": card.title, "details": card.details, "position": card.position})
            self._write(data)
        return self.get_board(user_id)
