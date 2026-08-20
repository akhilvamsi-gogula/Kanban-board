from fastapi.testclient import TestClient

from app import main
from app.main import app
from app.repository import KanbanRepository


client = TestClient(app)


def test_health_endpoint() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_hello_endpoint() -> None:
    response = client.get("/api/hello")

    assert response.status_code == 200
    assert response.json() == {"message": "Hello from the Kanban backend"}


def test_smoke_test_page_calls_hello_endpoint() -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert "/api/hello" in response.text


def test_get_board_initializes_seeded_database(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(main, "repository", KanbanRepository(tmp_path / "kanban.json"))

    response = client.get("/api/users/demo-user/board")

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Q3 product launch"
    assert len(body["columns"]) == 5
    assert (tmp_path / "kanban.json").exists()


def test_update_board_persists_column_and_card_changes(tmp_path, monkeypatch) -> None:
    repository = KanbanRepository(tmp_path / "kanban.json")
    monkeypatch.setattr(main, "repository", repository)
    original = client.get("/api/users/demo-user/board").json()
    original["columns"][3]["name"] = "QA"
    card = original["columns"][3]["cards"].pop()
    card["position"] = 1
    original["columns"][4]["cards"].append(card)
    payload = {"name": original["name"], "columns": original["columns"]}

    update_response = client.put("/api/users/demo-user/board", json=payload)
    read_response = client.get("/api/users/demo-user/board")

    assert update_response.status_code == 200
    assert read_response.json()["columns"][3]["name"] == "QA"
    assert read_response.json()["columns"][4]["cards"][1]["id"] == "qa-release"


def test_board_api_rejects_unknown_user_and_invalid_column_count(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(main, "repository", KanbanRepository(tmp_path / "kanban.json"))

    missing_response = client.get("/api/users/missing-user/board")
    invalid_response = client.put("/api/users/demo-user/board", json={"name": "Bad", "columns": []})

    assert missing_response.status_code == 404
    assert invalid_response.status_code == 422


def test_corrupt_database_returns_server_error(tmp_path, monkeypatch) -> None:
    database = tmp_path / "kanban.json"
    database.write_text("{not valid json", encoding="utf-8")
    monkeypatch.setattr(main, "repository", KanbanRepository(database))

    response = client.get("/api/users/demo-user/board")

    assert response.status_code == 500
    assert response.json() == {"detail": "Kanban database is unreadable"}


def test_structurally_invalid_database_returns_server_error(tmp_path, monkeypatch) -> None:
    database = tmp_path / "kanban.json"
    database.write_text('{"schema_version": 1, "users": [], "boards": [], "columns": [], "cards": [], "extra": true}', encoding="utf-8")
    monkeypatch.setattr(main, "repository", KanbanRepository(database))

    response = client.get("/api/users/demo-user/board")

    assert response.status_code == 500
    assert response.json() == {"detail": "Kanban database structure is invalid"}
