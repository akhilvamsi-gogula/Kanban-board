import httpx
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


def test_ai_health_check_requires_api_key(monkeypatch) -> None:
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)

    response = client.get("/api/ai/check")

    assert response.status_code == 503
    assert "OPENROUTER_API_KEY" in response.json()["detail"]


def test_ai_chat_requires_prompt(monkeypatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    response = client.post("/api/ai/chat", json={"prompt": "   "})

    assert response.status_code == 422


def test_ai_chat_accepts_api_board_shape() -> None:
    board = {
        "id": "q3-product-launch",
        "owner_id": "demo-user",
        "name": "Q3 product launch",
        "columns": [
            {"id": "backlog", "name": "Backlog", "accent": "#8b95a5", "position": 0, "cards": []},
            {"id": "up-next", "name": "Up next", "accent": "#ecad0a", "position": 1, "cards": []},
            {"id": "in-progress", "name": "In progress", "accent": "#209dd7", "position": 2, "cards": []},
            {"id": "review", "name": "Review", "accent": "#753991", "position": 3, "cards": []},
            {"id": "done", "name": "Done", "accent": "#2f9d70", "position": 4, "cards": []},
        ],
    }

    request = main.AiChatRequest.model_validate({"prompt": "hi", "board": board})

    assert request.board is not None
    assert request.board.model_dump()["id"] == "q3-product-launch"


def test_ai_chat_succeeds_with_valid_provider_response(monkeypatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv("OPENROUTER_MODEL", "openai/gpt-oss-20b:free")

    class FakeResponse:
        status_code = 200

        def json(self):
            return {
                "choices": [{"message": {"content": '{"assistant_message":"I can rename the backlog.","board_update":{"columns":[{"id":"backlog","name":"Ideas"}]}}'}}]
            }

    def fake_post(url: str, *, headers: dict[str, str], json: dict, timeout: float) -> FakeResponse:
        assert url == "https://openrouter.ai/api/v1/chat/completions"
        assert headers["Authorization"] == "Bearer test-key"
        assert json["model"] == "openai/gpt-oss-20b:free"
        assert json["messages"][0]["content"].startswith("You are a Kanban assistant")
        assert json["reasoning"] == {"exclude": True}
        assert timeout == 15.0
        return FakeResponse()

    monkeypatch.setattr(main.httpx, "post", fake_post)

    response = client.post(
        "/api/ai/chat",
        json={
            "prompt": "Rename backlog to ideas.",
            "board": {
                "name": "Q3 product launch",
                "columns": [
                    {"id": "backlog", "name": "Backlog", "accent": "#8b95a5", "position": 0, "cards": []},
                    {"id": "up-next", "name": "Up next", "accent": "#ecad0a", "position": 1, "cards": []},
                    {"id": "in-progress", "name": "In progress", "accent": "#209dd7", "position": 2, "cards": []},
                    {"id": "review", "name": "Review", "accent": "#753991", "position": 3, "cards": []},
                    {"id": "done", "name": "Done", "accent": "#2f9d70", "position": 4, "cards": []},
                ],
            },
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["assistant_message"] == "I can rename the backlog."
    assert body["board_update"]["columns"][0]["name"] == "Ideas"


def test_ai_health_check_succeeds_with_valid_provider_response(monkeypatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv("OPENROUTER_MODEL", "openai/gpt-oss-20b:free")

    class FakeResponse:
        status_code = 200

        def json(self):
            return {"choices": [{"message": {"content": "4"}}]}

    def fake_post(url: str, *, headers: dict[str, str], json: dict, timeout: float) -> FakeResponse:
        assert url == "https://openrouter.ai/api/v1/chat/completions"
        assert headers["Authorization"] == "Bearer test-key"
        assert headers["Content-Type"] == "application/json"
        assert json["model"] == "openai/gpt-oss-20b:free"
        assert json["messages"][0]["content"] == "Compute 2 + 2 and answer only with a single number."
        assert timeout == 15.0
        return FakeResponse()

    monkeypatch.setattr(main.httpx, "post", fake_post)

    response = client.get("/api/ai/check")

    assert response.status_code == 200
    assert response.json() == {"ok": True, "answer": "4"}


def test_ai_health_check_rejects_malformed_provider_response(monkeypatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    class FakeResponse:
        status_code = 200

        def json(self):
            return {"bad": "shape"}

    monkeypatch.setattr(main.httpx, "post", lambda *args, **kwargs: FakeResponse())

    response = client.get("/api/ai/check")

    assert response.status_code == 502
    assert "malformed" in response.json()["detail"].lower()


def test_ai_health_check_handles_provider_timeout(monkeypatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    def fake_post(*args, **kwargs):
        raise httpx.TimeoutException("timed out")

    monkeypatch.setattr(main.httpx, "post", fake_post)

    response = client.get("/api/ai/check")

    assert response.status_code == 504
    assert "timed out" in response.json()["detail"].lower()
