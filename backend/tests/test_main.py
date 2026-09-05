import asyncio
import os

import httpx
import psycopg
import pytest
from fastapi.testclient import TestClient

from app import main
from app.main import app
from app.repository import KanbanRepository


client = TestClient(app)

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", "postgresql://kanban:kanban@localhost:5432/kanban")
_TABLES = ("cards", "columns", "boards", "password_resets", "sessions", "users", "ai_chat_messages")


@pytest.fixture(autouse=True)
def repository():
    repo = KanbanRepository(TEST_DATABASE_URL)
    with psycopg.connect(TEST_DATABASE_URL) as conn:
        conn.execute(f"TRUNCATE {', '.join(_TABLES)} RESTART IDENTITY CASCADE")
        conn.commit()
    main.repository = repo
    yield repo


@pytest.fixture(autouse=True)
def reset_rate_limits():
    main._ai_request_log.clear()
    main._auth_request_log.clear()
    yield


@pytest.fixture(autouse=True)
def reset_session_cookie():
    client.cookies.clear()
    yield


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


def _signup(username: str = "alice", password: str = "correct-horse-battery") -> dict:
    response = client.post("/api/auth/signup", json={"username": username, "password": password})
    assert response.status_code == 201
    return response.json()


def _first_board_id() -> str:
    return client.get("/api/boards").json()[0]["id"]


def _valid_board_payload(name: str = "Bad") -> dict:
    return {
        "name": name,
        "columns": [
            {"id": "backlog", "name": "Backlog", "accent": "#8b95a5", "position": 0, "cards": []},
            {"id": "up-next", "name": "Up next", "accent": "#ecad0a", "position": 1, "cards": []},
            {"id": "in-progress", "name": "In progress", "accent": "#209dd7", "position": 2, "cards": []},
            {"id": "review", "name": "Review", "accent": "#753991", "position": 3, "cards": []},
            {"id": "done", "name": "Done", "accent": "#2f9d70", "position": 4, "cards": []},
        ],
    }


def test_list_boards_returns_seeded_board_after_signup() -> None:
    _signup()

    response = client.get("/api/boards")

    assert response.status_code == 200
    boards = response.json()
    assert len(boards) == 1
    assert boards[0]["name"] == "My board"


def test_get_board_initializes_seeded_board() -> None:
    _signup()
    board_id = _first_board_id()

    response = client.get(f"/api/boards/{board_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "My board"
    assert len(body["columns"]) == 5


def test_update_board_persists_column_and_card_changes() -> None:
    _signup()
    board_id = _first_board_id()
    original = client.get(f"/api/boards/{board_id}").json()
    original["columns"][3]["name"] = "QA"
    card = {"id": "qa-release", "title": "QA the release", "details": "", "position": 0}
    original["columns"][3]["cards"] = [card]
    payload = {"name": original["name"], "columns": original["columns"]}

    update_response = client.put(f"/api/boards/{board_id}", json=payload)
    read_response = client.get(f"/api/boards/{board_id}")

    assert update_response.status_code == 200
    assert read_response.json()["columns"][3]["name"] == "QA"
    assert read_response.json()["columns"][3]["cards"][0]["id"] == "qa-release"


def test_board_api_rejects_invalid_column_count() -> None:
    _signup()
    board_id = _first_board_id()

    invalid_response = client.put(f"/api/boards/{board_id}", json={"name": "Bad", "columns": []})

    assert invalid_response.status_code == 422


def test_board_api_rejects_duplicate_column_ids() -> None:
    _signup()
    board_id = _first_board_id()
    payload = _valid_board_payload()
    payload["columns"][1]["id"] = payload["columns"][0]["id"]

    response = client.put(f"/api/boards/{board_id}", json=payload)

    assert response.status_code == 422


def test_board_api_rejects_duplicate_card_ids_across_columns() -> None:
    _signup()
    board_id = _first_board_id()
    payload = _valid_board_payload()
    payload["columns"][0]["cards"] = [{"id": "dup", "title": "First", "details": "", "position": 0}]
    payload["columns"][1]["cards"] = [{"id": "dup", "title": "Second", "details": "", "position": 0}]

    response = client.put(f"/api/boards/{board_id}", json=payload)

    assert response.status_code == 422


def test_board_api_rejects_non_contiguous_card_positions() -> None:
    _signup()
    board_id = _first_board_id()
    payload = _valid_board_payload()
    payload["columns"][0]["cards"] = [
        {"id": "card-a", "title": "A", "details": "", "position": 0},
        {"id": "card-b", "title": "B", "details": "", "position": 2},
    ]

    response = client.put(f"/api/boards/{board_id}", json=payload)

    assert response.status_code == 422


def test_board_api_rejects_card_id_not_matching_pattern() -> None:
    _signup()
    board_id = _first_board_id()
    payload = _valid_board_payload()
    payload["columns"][0]["cards"] = [{"id": "Not-Lowercase", "title": "Bad id", "details": "", "position": 0}]

    response = client.put(f"/api/boards/{board_id}", json=payload)

    assert response.status_code == 422


def test_board_api_rejects_card_title_over_max_length() -> None:
    _signup()
    board_id = _first_board_id()
    payload = _valid_board_payload()
    payload["columns"][0]["cards"] = [{"id": "too-long", "title": "x" * 201, "details": "", "position": 0}]

    response = client.put(f"/api/boards/{board_id}", json=payload)

    assert response.status_code == 422


def test_board_api_accepts_card_title_at_max_length_boundary() -> None:
    _signup()
    board_id = _first_board_id()
    payload = _valid_board_payload()
    payload["columns"][0]["cards"] = [{"id": "exactly-max", "title": "x" * 200, "details": "", "position": 0}]

    response = client.put(f"/api/boards/{board_id}", json=payload)

    assert response.status_code == 200
    assert response.json()["columns"][0]["cards"][0]["title"] == "x" * 200


def test_board_api_rejects_board_name_over_max_length() -> None:
    _signup()
    board_id = _first_board_id()
    payload = _valid_board_payload(name="x" * 121)

    response = client.put(f"/api/boards/{board_id}", json=payload)

    assert response.status_code == 422


def test_board_endpoints_require_authentication() -> None:
    list_response = client.get("/api/boards")
    create_response = client.post("/api/boards", json={"name": "New board"})
    get_response = client.get("/api/boards/some-id")
    put_response = client.put("/api/boards/some-id", json={"name": "Bad", "columns": []})
    patch_response = client.patch("/api/boards/some-id", json={"name": "Bad"})
    delete_response = client.delete("/api/boards/some-id")

    assert list_response.status_code == 401
    assert create_response.status_code == 401
    assert get_response.status_code == 401
    assert put_response.status_code == 401
    assert patch_response.status_code == 401
    assert delete_response.status_code == 401


def test_create_board_adds_new_board_with_default_columns() -> None:
    _signup()
    seeded_id = _first_board_id()

    response = client.post("/api/boards", json={"name": "Second board"})

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Second board"
    assert len(body["columns"]) == 5
    assert body["id"] != seeded_id
    listed_ids = {board["id"] for board in client.get("/api/boards").json()}
    assert listed_ids == {seeded_id, body["id"]}


def test_create_board_rejects_invalid_name() -> None:
    _signup()

    response = client.post("/api/boards", json={"name": ""})

    assert response.status_code == 422


def test_boards_are_isolated_by_id() -> None:
    _signup()
    first_id = _first_board_id()
    second = client.post("/api/boards", json={"name": "Second board"}).json()

    second_board = client.get(f"/api/boards/{second['id']}").json()
    second_board["columns"][0]["cards"] = [
        {"id": "only-on-second", "title": "Only here", "details": "", "position": 0}
    ]
    client.put(f"/api/boards/{second['id']}", json={"name": second_board["name"], "columns": second_board["columns"]})

    first_board = client.get(f"/api/boards/{first_id}").json()
    assert all(not column["cards"] for column in first_board["columns"])


def test_cannot_access_another_users_board() -> None:
    _signup(username="board-owner")
    owner_board_id = _first_board_id()
    client.post("/api/auth/logout")
    _signup(username="intruder")

    get_response = client.get(f"/api/boards/{owner_board_id}")
    put_response = client.put(f"/api/boards/{owner_board_id}", json=_valid_board_payload("Hijacked"))
    delete_response = client.delete(f"/api/boards/{owner_board_id}")

    assert get_response.status_code == 404
    assert put_response.status_code == 404
    assert delete_response.status_code == 404


def test_board_not_found_returns_404() -> None:
    _signup()

    get_response = client.get("/api/boards/does-not-exist")
    put_response = client.put("/api/boards/does-not-exist", json=_valid_board_payload())
    delete_response = client.delete("/api/boards/does-not-exist")

    assert get_response.status_code == 404
    assert put_response.status_code == 404
    assert delete_response.status_code == 404


def test_delete_board_removes_it_from_list() -> None:
    _signup()
    seeded_id = _first_board_id()
    second = client.post("/api/boards", json={"name": "Second board"}).json()

    delete_response = client.delete(f"/api/boards/{second['id']}")
    listed_ids = {board["id"] for board in client.get("/api/boards").json()}
    get_after_delete = client.get(f"/api/boards/{second['id']}")

    assert delete_response.status_code == 204
    assert listed_ids == {seeded_id}
    assert get_after_delete.status_code == 404


def test_cannot_delete_last_board() -> None:
    _signup()
    board_id = _first_board_id()

    response = client.delete(f"/api/boards/{board_id}")

    assert response.status_code == 409


def test_rename_board() -> None:
    _signup()
    board_id = _first_board_id()

    response = client.patch(f"/api/boards/{board_id}", json={"name": "Renamed board"})

    assert response.status_code == 200
    assert response.json()["name"] == "Renamed board"
    assert client.get("/api/boards").json()[0]["name"] == "Renamed board"


def test_rename_board_rejects_invalid_name() -> None:
    _signup()
    board_id = _first_board_id()

    response = client.patch(f"/api/boards/{board_id}", json={"name": ""})

    assert response.status_code == 422


def test_cannot_rename_another_users_board() -> None:
    _signup(username="board-owner-2")
    owner_board_id = _first_board_id()
    client.post("/api/auth/logout")
    _signup(username="intruder-2")

    response = client.patch(f"/api/boards/{owner_board_id}", json={"name": "Hijacked"})

    assert response.status_code == 404


def test_database_error_returns_server_error() -> None:
    with psycopg.connect(TEST_DATABASE_URL) as conn:
        conn.execute("DROP TABLE users CASCADE")
        conn.commit()

    response = client.post("/api/auth/signup", json={"username": "bob", "password": "correct-horse-battery"})

    assert response.status_code == 500
    assert response.json() == {"detail": "Kanban database is not writable"}


def test_signup_rejects_duplicate_username() -> None:
    _signup(username="carol")

    response = client.post("/api/auth/signup", json={"username": "carol", "password": "another-password"})

    assert response.status_code == 409


def test_login_succeeds_with_correct_password_and_fails_with_wrong_one() -> None:
    _signup(username="dave", password="right-password")
    client.post("/api/auth/logout")

    good_response = client.post("/api/auth/login", json={"username": "dave", "password": "right-password"})
    client.post("/api/auth/logout")
    bad_response = client.post("/api/auth/login", json={"username": "dave", "password": "wrong-password"})

    assert good_response.status_code == 200
    assert good_response.json()["username"] == "dave"
    assert bad_response.status_code == 401


def test_session_cookie_is_not_secure_by_default_for_local_http_dev() -> None:
    response = client.post("/api/auth/signup", json={"username": "cookie-check", "password": "correct-horse-battery"})

    set_cookie = response.headers["set-cookie"].lower()
    assert "httponly" in set_cookie
    assert "samesite=lax" in set_cookie
    assert "secure" not in set_cookie


def test_session_cookie_is_secure_when_running_on_render(monkeypatch) -> None:
    monkeypatch.setattr(main, "SESSION_COOKIE_SECURE", True)

    response = client.post("/api/auth/signup", json={"username": "cookie-check-render", "password": "correct-horse-battery"})

    assert "secure" in response.headers["set-cookie"].lower()


def test_login_fails_for_nonexistent_username_with_same_generic_message() -> None:
    _signup(username="known-user", password="right-password")
    client.post("/api/auth/logout")

    response = client.post("/api/auth/login", json={"username": "no-such-user", "password": "whatever1"})

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid username or password"


@pytest.mark.parametrize(
    "username,password",
    [
        ("ab", "correct-horse-battery"),  # username below 3-char minimum
        ("x" * 33, "correct-horse-battery"),  # username above 32-char maximum
        ("bad user!", "correct-horse-battery"),  # username has disallowed characters
        ("valid-name", "short12"),  # password below 8-char minimum
    ],
)
def test_signup_rejects_invalid_username_or_password(username: str, password: str) -> None:
    response = client.post("/api/auth/signup", json={"username": username, "password": password})

    assert response.status_code == 422


def test_signup_accepts_boundary_length_username_and_password() -> None:
    response = client.post("/api/auth/signup", json={"username": "abc", "password": "x" * 8})

    assert response.status_code == 201

    client.post("/api/auth/logout")
    response = client.post("/api/auth/signup", json={"username": "y" * 32, "password": "z" * 128})

    assert response.status_code == 201


def test_password_longer_than_bcrypt_limit_still_authenticates_consistently() -> None:
    # bcrypt only considers the first 72 bytes of input (see repository._hash_password);
    # passwords sharing that 72-byte prefix are indistinguishable to it - a known
    # limitation, not a bug, and worth pinning down so a future change doesn't silently
    # start rejecting long passwords or start treating them as unique beyond byte 72.
    shared_prefix = "p" * 72
    _signup(username="grace", password=shared_prefix + "-original-tail")
    client.post("/api/auth/logout")

    same_prefix_response = client.post(
        "/api/auth/login", json={"username": "grace", "password": shared_prefix + "-different-tail"}
    )

    assert same_prefix_response.status_code == 200


def test_me_requires_authentication() -> None:

    response = client.get("/api/auth/me")

    assert response.status_code == 401


def test_logout_invalidates_session() -> None:
    _signup(username="erin")

    logout_response = client.post("/api/auth/logout")
    me_response = client.get("/api/auth/me")

    assert logout_response.status_code == 200
    assert me_response.status_code == 401


def test_forgot_password_for_unknown_user_returns_200_without_token() -> None:

    response = client.post("/api/auth/forgot-password", json={"username": "nobody"})

    assert response.status_code == 200
    assert response.json()["reset_token"] is None


def test_forgot_password_reset_then_login_flow() -> None:
    _signup(username="frank", password="old-password")
    client.post("/api/auth/logout")

    forgot_response = client.post("/api/auth/forgot-password", json={"username": "frank"})
    reset_token = forgot_response.json()["reset_token"]
    assert reset_token is not None

    reset_response = client.post("/api/auth/reset-password", json={"token": reset_token, "new_password": "new-password"})
    old_password_response = client.post("/api/auth/login", json={"username": "frank", "password": "old-password"})
    new_password_response = client.post("/api/auth/login", json={"username": "frank", "password": "new-password"})

    assert forgot_response.status_code == 200
    assert reset_response.status_code == 200
    assert old_password_response.status_code == 401
    assert new_password_response.status_code == 200


def test_reset_password_rejects_invalid_token() -> None:
    response = client.post("/api/auth/reset-password", json={"token": "not-a-real-token", "new_password": "new-password"})

    assert response.status_code == 400


def test_reset_password_rejects_reusing_an_already_used_token() -> None:
    _signup(username="gina", password="old-password")
    client.post("/api/auth/logout")
    reset_token = client.post("/api/auth/forgot-password", json={"username": "gina"}).json()["reset_token"]
    first_use = client.post("/api/auth/reset-password", json={"token": reset_token, "new_password": "new-password-1"})

    second_use = client.post("/api/auth/reset-password", json={"token": reset_token, "new_password": "new-password-2"})

    assert first_use.status_code == 200
    assert second_use.status_code == 400


def test_reset_password_rejects_expired_token() -> None:
    _signup(username="hank", password="old-password")
    client.post("/api/auth/logout")
    reset_token = client.post("/api/auth/forgot-password", json={"username": "hank"}).json()["reset_token"]
    with psycopg.connect(TEST_DATABASE_URL) as conn:
        conn.execute("UPDATE password_resets SET expires_at = '2000-01-01T00:00:00+00:00'")
        conn.commit()

    response = client.post("/api/auth/reset-password", json={"token": reset_token, "new_password": "new-password"})

    assert response.status_code == 400


def test_reset_password_invalidates_existing_sessions() -> None:
    _signup(username="ivan", password="old-password")
    me_before = client.get("/api/auth/me")
    reset_token = client.post("/api/auth/forgot-password", json={"username": "ivan"}).json()["reset_token"]

    client.post("/api/auth/reset-password", json={"token": reset_token, "new_password": "new-password"})
    me_after = client.get("/api/auth/me")

    assert me_before.status_code == 200
    assert me_after.status_code == 401


def test_expired_session_requires_reauthentication() -> None:
    _signup(username="jill")
    with psycopg.connect(TEST_DATABASE_URL) as conn:
        conn.execute("UPDATE sessions SET expires_at = '2000-01-01T00:00:00+00:00'")
        conn.commit()

    response = client.get("/api/auth/me")

    assert response.status_code == 401


def test_ai_health_check_requires_api_key(monkeypatch) -> None:
    monkeypatch.delenv("GROQ_API_KEY", raising=False)

    response = client.get("/api/ai/check")

    assert response.status_code == 503
    assert "GROQ_API_KEY" in response.json()["detail"]


def test_ai_chat_requires_prompt(monkeypatch) -> None:
    monkeypatch.setenv("GROQ_API_KEY", "test-key")

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
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    monkeypatch.setenv("GROQ_MODEL", "openai/gpt-oss-20b")

    class FakeResponse:
        status_code = 200

        def json(self):
            return {
                "choices": [{"message": {"content": '{"assistant_message":"I can rename the backlog.","board_update":{"columns":[{"id":"backlog","name":"Ideas"}]}}'}}]
            }

    async def fake_post(self, url: str, *, headers: dict[str, str], json: dict) -> FakeResponse:
        assert url == "https://api.groq.com/openai/v1/chat/completions"
        assert headers["Authorization"] == "Bearer test-key"
        assert json["model"] == "openai/gpt-oss-20b"
        assert json["messages"][0]["content"].startswith("You are a Kanban assistant")
        assert json["reasoning_effort"] == "medium"
        assert json["include_reasoning"] is False
        return FakeResponse()

    monkeypatch.setattr(main.httpx.AsyncClient, "post", fake_post)

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


def test_ai_chat_logs_prompt_and_reply_scoped_to_the_requesting_user(monkeypatch) -> None:
    monkeypatch.setenv("GROQ_API_KEY", "test-key")

    class FakeResponse:
        status_code = 200

        def json(self):
            return {"choices": [{"message": {"content": '{"assistant_message":"There are no cards yet."}'}}]}

    async def fake_post(self, *args, **kwargs) -> FakeResponse:
        return FakeResponse()

    monkeypatch.setattr(main.httpx.AsyncClient, "post", fake_post)

    response = client.post(
        "/api/ai/chat",
        json={
            "prompt": "How many cards are there?",
            "board": {
                "id": "board-1",
                "owner_id": "user-1",
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

    with psycopg.connect(TEST_DATABASE_URL, row_factory=psycopg.rows.dict_row) as conn:
        rows = conn.execute(
            "SELECT user_id, board_id, role, content FROM ai_chat_messages ORDER BY row_id"
        ).fetchall()

    assert [dict(row) for row in rows] == [
        {"user_id": "user-1", "board_id": "board-1", "role": "user", "content": "How many cards are there?"},
        {"user_id": "user-1", "board_id": "board-1", "role": "assistant", "content": "There are no cards yet."},
    ]


def test_ai_chat_logs_null_ids_when_called_without_a_board(monkeypatch) -> None:
    monkeypatch.setenv("GROQ_API_KEY", "test-key")

    class FakeResponse:
        status_code = 200

        def json(self):
            return {"choices": [{"message": {"content": '{"assistant_message":"Hello there."}'}}]}

    async def fake_post(self, *args, **kwargs) -> FakeResponse:
        return FakeResponse()

    monkeypatch.setattr(main.httpx.AsyncClient, "post", fake_post)

    response = client.post("/api/ai/chat", json={"prompt": "Just saying hi, no board attached."})

    assert response.status_code == 200
    with psycopg.connect(TEST_DATABASE_URL, row_factory=psycopg.rows.dict_row) as conn:
        rows = conn.execute("SELECT user_id, board_id, role FROM ai_chat_messages ORDER BY row_id").fetchall()
    assert [dict(row) for row in rows] == [
        {"user_id": None, "board_id": None, "role": "user"},
        {"user_id": None, "board_id": None, "role": "assistant"},
    ]


def test_ai_chat_rejects_prompt_over_max_length(monkeypatch) -> None:
    monkeypatch.setenv("GROQ_API_KEY", "test-key")

    response = client.post("/api/ai/chat", json={"prompt": "x" * 2001})

    assert response.status_code == 422


def test_ai_chat_forwards_only_the_last_eight_history_messages(monkeypatch) -> None:
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    sent_messages = {}

    class FakeResponse:
        status_code = 200

        def json(self):
            return {"choices": [{"message": {"content": '{"assistant_message":"Got it."}'}}]}

    async def fake_post(self, url: str, *, headers: dict[str, str], json: dict) -> FakeResponse:
        sent_messages["messages"] = json["messages"]
        return FakeResponse()

    monkeypatch.setattr(main.httpx.AsyncClient, "post", fake_post)

    history = [{"role": "user" if i % 2 == 0 else "assistant", "content": f"message {i}"} for i in range(12)]
    response = client.post("/api/ai/chat", json={"prompt": "Latest question", "history": history})

    assert response.status_code == 200
    # messages[0] is the system prompt, then the last 8 history entries, then the new prompt.
    forwarded_history = sent_messages["messages"][1:9]
    assert [message["content"] for message in forwarded_history] == [f"message {i}" for i in range(4, 12)]
    assert sent_messages["messages"][9]["content"] == "Latest question"


def test_ai_chat_retries_once_on_malformed_response_then_succeeds(monkeypatch) -> None:
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    call_count = {"n": 0}

    class FakeResponse:
        def __init__(self, content: str) -> None:
            self.status_code = 200
            self._content = content

        def json(self):
            return {"choices": [{"message": {"content": self._content}}]}

    async def fake_post(self, *args, **kwargs) -> FakeResponse:
        call_count["n"] += 1
        if call_count["n"] == 1:
            return FakeResponse('{"assistant_message": "broken", "board_update": [not valid json')
        return FakeResponse('{"assistant_message": "Got it.", "board_update": null}')

    monkeypatch.setattr(main.httpx.AsyncClient, "post", fake_post)

    response = client.post("/api/ai/chat", json={"prompt": "rename something"})

    assert response.status_code == 200
    assert response.json()["assistant_message"] == "Got it."
    assert call_count["n"] == 2


def test_ai_chat_fails_after_exhausting_retries_on_malformed_response(monkeypatch) -> None:
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    call_count = {"n": 0}

    class FakeResponse:
        status_code = 200

        def json(self):
            return {"choices": [{"message": {"content": "[not valid json"}}]}

    async def fake_post(self, *args, **kwargs) -> FakeResponse:
        call_count["n"] += 1
        return FakeResponse()

    monkeypatch.setattr(main.httpx.AsyncClient, "post", fake_post)

    response = client.post("/api/ai/chat", json={"prompt": "rename something"})

    assert response.status_code == 502
    assert "malformed" in response.json()["detail"].lower()
    assert call_count["n"] == 2


def test_ai_chat_retries_when_assistant_claims_a_change_without_board_update(monkeypatch) -> None:
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    call_count = {"n": 0}

    class FakeResponse:
        def __init__(self, content: str) -> None:
            self.status_code = 200
            self._content = content

        def json(self):
            return {"choices": [{"message": {"content": self._content}}]}

    async def fake_post(self, *args, **kwargs) -> FakeResponse:
        call_count["n"] += 1
        if call_count["n"] == 1:
            return FakeResponse('{"assistant_message": "Moved the cards to Backlog.", "board_update": null}')
        return FakeResponse(
            '{"assistant_message": "Moved the cards to Backlog.", '
            '"board_update": {"columns": [{"id": "backlog", "cards": [{"id": "c1", "title": "x", "details": "", "position": 0}]}]}}'
        )

    monkeypatch.setattr(main.httpx.AsyncClient, "post", fake_post)

    response = client.post("/api/ai/chat", json={"prompt": "move the cards to backlog"})

    assert response.status_code == 200
    assert response.json()["board_update"] is not None
    assert call_count["n"] == 2


def test_ai_chat_does_not_retry_when_no_change_was_claimed(monkeypatch) -> None:
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    call_count = {"n": 0}

    class FakeResponse:
        status_code = 200

        def json(self):
            return {"choices": [{"message": {"content": '{"assistant_message": "There are 3 cards on the board.", "board_update": null}'}}]}

    async def fake_post(self, *args, **kwargs) -> FakeResponse:
        call_count["n"] += 1
        return FakeResponse()

    monkeypatch.setattr(main.httpx.AsyncClient, "post", fake_post)

    response = client.post("/api/ai/chat", json={"prompt": "how many cards are there?"})

    assert response.status_code == 200
    assert response.json()["board_update"] is None
    assert call_count["n"] == 1


def test_ai_chat_retries_when_card_update_omits_title(monkeypatch) -> None:
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    call_count = {"n": 0}

    class FakeResponse:
        def __init__(self, content: str) -> None:
            self.status_code = 200
            self._content = content

        def json(self):
            return {"choices": [{"message": {"content": self._content}}]}

    async def fake_post(self, *args, **kwargs) -> FakeResponse:
        call_count["n"] += 1
        if call_count["n"] == 1:
            # A model that uses "name" instead of "title" for a card must not pass
            # validation silently - that shape mismatch used to slip through and only
            # fail later, invisibly, when the frontend tried to save it.
            return FakeResponse(
                '{"assistant_message": "Added a card.", '
                '"board_update": {"columns": [{"id": "backlog", "cards": [{"id": "c1", "name": "x", "details": ""}]}]}}'
            )
        return FakeResponse(
            '{"assistant_message": "Added a card.", '
            '"board_update": {"columns": [{"id": "backlog", "cards": [{"id": "c1", "title": "x", "details": ""}]}]}}'
        )

    monkeypatch.setattr(main.httpx.AsyncClient, "post", fake_post)

    response = client.post("/api/ai/chat", json={"prompt": "add a card"})

    assert response.status_code == 200
    assert response.json()["board_update"]["columns"][0]["cards"][0]["title"] == "x"
    assert call_count["n"] == 2


def test_ai_health_check_succeeds_with_valid_provider_response(monkeypatch) -> None:
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    monkeypatch.setenv("GROQ_MODEL", "openai/gpt-oss-20b")

    class FakeResponse:
        status_code = 200

        def json(self):
            return {"choices": [{"message": {"content": "4"}}]}

    async def fake_post(self, url: str, *, headers: dict[str, str], json: dict) -> FakeResponse:
        assert url == "https://api.groq.com/openai/v1/chat/completions"
        assert headers["Authorization"] == "Bearer test-key"
        assert headers["Content-Type"] == "application/json"
        assert json["model"] == "openai/gpt-oss-20b"
        assert json["messages"][0]["content"] == "Compute 2 + 2 and answer only with a single number."
        return FakeResponse()

    monkeypatch.setattr(main.httpx.AsyncClient, "post", fake_post)

    response = client.get("/api/ai/check")

    assert response.status_code == 200
    assert response.json() == {"ok": True, "answer": "4"}


def test_ai_health_check_surfaces_provider_error_detail(monkeypatch) -> None:
    monkeypatch.setenv("GROQ_API_KEY", "test-key")

    class FakeResponse:
        status_code = 402

        def json(self):
            return {"error": {"message": "Insufficient credits.", "code": 402}}

    async def fake_post(self, *args, **kwargs) -> FakeResponse:
        return FakeResponse()

    monkeypatch.setattr(main.httpx.AsyncClient, "post", fake_post)

    response = client.get("/api/ai/check")

    assert response.status_code == 502
    assert response.json() == {"detail": "Insufficient credits."}


def test_ai_health_check_rejects_malformed_provider_response(monkeypatch) -> None:
    monkeypatch.setenv("GROQ_API_KEY", "test-key")

    class FakeResponse:
        status_code = 200

        def json(self):
            return {"bad": "shape"}

    async def fake_post(self, *args, **kwargs) -> FakeResponse:
        return FakeResponse()

    monkeypatch.setattr(main.httpx.AsyncClient, "post", fake_post)

    response = client.get("/api/ai/check")

    assert response.status_code == 502
    assert "malformed" in response.json()["detail"].lower()


def test_ai_health_check_handles_provider_timeout(monkeypatch) -> None:
    monkeypatch.setenv("GROQ_API_KEY", "test-key")

    async def fake_post(self, *args, **kwargs):
        raise httpx.TimeoutException("timed out")

    monkeypatch.setattr(main.httpx.AsyncClient, "post", fake_post)

    response = client.get("/api/ai/check")

    assert response.status_code == 504
    assert "timed out" in response.json()["detail"].lower()


def test_ai_rate_limit_blocks_excess_requests(monkeypatch) -> None:
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    monkeypatch.setattr(main, "AI_RATE_LIMIT_MAX_REQUESTS", 3)

    responses = [client.get("/api/ai/check") for _ in range(4)]

    assert [response.status_code for response in responses] == [503, 503, 503, 429]
    assert "too many" in responses[-1].json()["detail"].lower()


def test_auth_rate_limit_blocks_excess_requests(monkeypatch) -> None:
    monkeypatch.setattr(main, "AUTH_RATE_LIMIT_MAX_REQUESTS", 3)

    responses = [
        client.post("/api/auth/login", json={"username": "nobody", "password": "irrelevant"}) for _ in range(4)
    ]

    assert [response.status_code for response in responses] == [401, 401, 401, 429]
    assert "too many" in responses[-1].json()["detail"].lower()


def test_ai_chat_handles_slow_provider_with_keepalive_bytes(monkeypatch) -> None:
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    monkeypatch.setenv("GROQ_TIMEOUT_MS", "50")

    async def fake_post(self, *args, **kwargs):
        await asyncio.sleep(0.2)
        raise AssertionError("should have been cancelled by the enforced deadline")

    monkeypatch.setattr(main.httpx.AsyncClient, "post", fake_post)

    response = client.get("/api/ai/check")

    assert response.status_code == 504
    assert "timed out" in response.json()["detail"].lower()
