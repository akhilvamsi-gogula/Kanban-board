import asyncio
import os
import re
import time
from collections import defaultdict, deque
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import Cookie, Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
import json
from pydantic import ValidationError

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

from .models import (
    AiChatRequest,
    AiChatResponse,
    BoardResponse,
    BoardSummary,
    BoardUpdate,
    CreateBoardRequest,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    ResetPasswordRequest,
    SignupRequest,
    UserResponse,
)
from .repository import (
    DEFAULT_DATA_PATH,
    BoardNotFoundError,
    CannotDeleteLastBoardError,
    DataStoreError,
    KanbanRepository,
    UsernameTakenError,
)

app = FastAPI(title="Kanban Backend", version="0.1.0")
repository = KanbanRepository(Path(os.environ["KANBAN_DATA_PATH"]) if "KANBAN_DATA_PATH" in os.environ else DEFAULT_DATA_PATH)
cors_origins = [origin for origin in os.getenv("KANBAN_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if origin]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)

REPOSITORY_ERROR_STATUS: dict[type[Exception], int] = {
    BoardNotFoundError: 404,
    CannotDeleteLastBoardError: 409,
    DataStoreError: 500,
}


def _repository_error_response(request: Request, error: Exception) -> JSONResponse:
    return JSONResponse(status_code=REPOSITORY_ERROR_STATUS[type(error)], content={"detail": str(error)})


for _error_type in REPOSITORY_ERROR_STATUS:
    app.add_exception_handler(_error_type, _repository_error_response)


SESSION_COOKIE_NAME = "kanban_session"
SESSION_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60

AUTH_RATE_LIMIT_MAX_REQUESTS = 20
AUTH_RATE_LIMIT_WINDOW_SECONDS = 60
_auth_request_log: dict[str, deque[float]] = defaultdict(deque)


def enforce_auth_rate_limit(request: Request) -> None:
    # Guards signup/login/forgot-password against brute-force and spam, since these
    # endpoints are unauthenticated by definition.
    client_ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    timestamps = _auth_request_log[client_ip]
    while timestamps and now - timestamps[0] > AUTH_RATE_LIMIT_WINDOW_SECONDS:
        timestamps.popleft()
    if len(timestamps) >= AUTH_RATE_LIMIT_MAX_REQUESTS:
        raise HTTPException(status_code=429, detail="Too many requests. Please wait a moment and try again.")
    timestamps.append(now)


def get_current_user(kanban_session: str | None = Cookie(default=None)) -> UserResponse:
    if kanban_session is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = repository.get_user_by_session(kanban_session)
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=SESSION_COOKIE_MAX_AGE_SECONDS,
        httponly=True,
        samesite="lax",
        secure=False,
        path="/",
    )


SMOKE_TEST_PAGE = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Kanban backend smoke test</title>
    <style>
      :root { color-scheme: dark; font-family: sans-serif; }
      body { max-width: 42rem; margin: 4rem auto; padding: 0 1.25rem; background: #081525; color: #f4f7fb; }
      code { color: #35b9ee; }
      #result { padding: 1rem; border: 1px solid #264057; border-radius: 6px; background: #10253a; }
    </style>
  </head>
  <body>
    <h1>Kanban backend</h1>
    <p>This page confirms the static page and API are running together.</p>
    <p id="result">Calling <code>/api/hello</code>...</p>
    <script>
      fetch('/api/hello')
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        })
        .then((data) => { document.querySelector('#result').textContent = data.message; })
        .catch((error) => { document.querySelector('#result').textContent = `API error: ${error.message}`; });
    </script>
  </body>
</html>"""


CLAIMED_CHANGE_PATTERN = re.compile(r"\b(moved|added|created|deleted|removed|renamed|updated|reordered)\b", re.IGNORECASE)

AI_RATE_LIMIT_MAX_REQUESTS = 10
AI_RATE_LIMIT_WINDOW_SECONDS = 60
_ai_request_log: dict[str, deque[float]] = defaultdict(deque)


def enforce_ai_rate_limit(request: Request) -> None:
    # /api/ai/* has no authentication, so this is the only guard against a caller
    # who bypasses the frontend sign-in and hits the endpoint directly and burns through Groq's daily free quota.
    client_ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    timestamps = _ai_request_log[client_ip]
    while timestamps and now - timestamps[0] > AI_RATE_LIMIT_WINDOW_SECONDS:
        timestamps.popleft()
    if len(timestamps) >= AI_RATE_LIMIT_MAX_REQUESTS:
        raise HTTPException(status_code=429, detail="Too many AI requests. Please wait a moment and try again.")
    timestamps.append(now)


async def call_groq(payload: dict, api_key: str, timeout_ms: int) -> httpx.Response:
    timeout_seconds = timeout_ms / 1000
    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        try:
            return await asyncio.wait_for(
                client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json=payload,
                ),
                timeout=timeout_seconds,
            )
        except (TimeoutError, httpx.TimeoutException) as error:
            raise HTTPException(status_code=504, detail=f"Groq request timed out after {timeout_ms}ms.") from error
        except httpx.HTTPError as error:
            raise HTTPException(status_code=502, detail=f"Groq request failed: {error}") from error


@app.get("/", response_class=HTMLResponse)
def smoke_test_page() -> str:
    return SMOKE_TEST_PAGE


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/hello")
def hello() -> dict[str, str]:
    return {"message": "Hello from the Kanban backend"}


@app.get("/api/ai/check", dependencies=[Depends(enforce_ai_rate_limit)])
async def ai_connectivity_check() -> dict[str, object]:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY is not configured.")

    model = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
    timeout_ms = int(os.getenv("GROQ_TIMEOUT_MS", "15000"))
    prompt = "Compute 2 + 2 and answer only with a single number."

    response = await call_groq(
        {"model": model, "messages": [{"role": "user", "content": prompt}], "reasoning_effort": "low", "include_reasoning": False, "max_tokens": 100},
        api_key,
        timeout_ms,
    )

    if response.status_code >= 400:
        try:
            detail = response.json()["error"]["message"]
        except (KeyError, TypeError, ValueError):
            detail = f"Groq returned HTTP {response.status_code}."
        raise HTTPException(status_code=502, detail=detail)

    try:
        payload = response.json()
        content = payload["choices"][0]["message"]["content"]
        if content is None:
            raise ValueError("empty content")
        answer = str(content).strip()
    except (KeyError, IndexError, TypeError, ValueError):
        raise HTTPException(status_code=502, detail="Groq response was malformed.") from None

    if not answer:
        raise HTTPException(status_code=502, detail="Groq response was malformed.")

    return {"ok": True, "answer": answer}


@app.post("/api/ai/chat", response_model=AiChatResponse, dependencies=[Depends(enforce_ai_rate_limit)])
async def ai_chat(payload: AiChatRequest) -> AiChatResponse:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY is not configured.")

    model = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
    timeout_ms = int(os.getenv("GROQ_TIMEOUT_MS", "15000"))

    board_payload = payload.board.model_dump(mode="json") if payload.board else None
    history_payload = [message.model_dump(mode="json") for message in payload.history[-8:]]

    system_prompt = (
        "You are a Kanban assistant. Reply with JSON only and never send markdown. "
        "The JSON must have exactly two fields: assistant_message and optional board_update. "
        "If the user asks for a board change, include a valid board_update object using the same schema as the current board. "
        "Only make safe edits to the existing board: rename columns, add/rename/remove cards, and reorder cards within or across columns. "
        "There are always exactly 5 columns; never invent, remove, or rename a column's id, only its name. "
        "When adding a new card, invent a short new id for it: lowercase letters, digits, and hyphens only, starting with a letter, not already used by any existing card or column. "
        "Every card object has exactly the fields id, title, and details (details may be an empty string) - never use 'name' for a card's title. "
        "Preserve the id of every existing card and column you are not removing. "
        "If no board change is needed, omit board_update. "
        "If assistant_message describes a change you made, board_update must be included and reflect that exact change - never claim a change without including it."
    )

    messages = [{"role": "system", "content": system_prompt}]
    if history_payload:
        messages.extend(history_payload)
    messages.append({"role": "user", "content": payload.prompt})
    if board_payload is not None:
        messages.append({"role": "user", "content": f"Current board JSON: {board_payload}"})

    max_attempts = 2
    for attempt in range(1, max_attempts + 1):
        response = await call_groq(
            {"model": model, "messages": messages, "reasoning_effort": "medium", "include_reasoning": False, "max_tokens": 1500},
            api_key,
            timeout_ms,
        )

        if response.status_code == 429:
            raise HTTPException(status_code=429, detail="Groq rate limit reached. Please try again shortly.")
        if response.status_code >= 400:
            try:
                detail = response.json()["error"]["message"]
            except (KeyError, TypeError, ValueError):
                detail = f"Groq returned HTTP {response.status_code}."
            raise HTTPException(status_code=502, detail=detail)

        # Small/fast models occasionally emit invalid JSON or skip board_update despite
        # instructions; one retry resolves most of these transient generation failures.
        is_last_attempt = attempt == max_attempts
        try:
            payload_json = response.json()
            content = payload_json["choices"][0]["message"]["content"]
            if content is None:
                raise ValueError("empty content")
            parsed = json.loads(str(content).strip())
        except (KeyError, IndexError, TypeError, ValueError):
            if is_last_attempt:
                raise HTTPException(status_code=502, detail="Groq response was malformed.") from None
            continue

        try:
            assistant_message = str(parsed["assistant_message"]).strip()
            if not assistant_message:
                raise ValueError("missing message")
            board_update = parsed.get("board_update")
            if board_update is None and CLAIMED_CHANGE_PATTERN.search(assistant_message):
                # The model sometimes claims it made a change (per the instruction above) but
                # omits board_update anyway; treat that as a failed generation and retry it.
                raise ValueError("assistant claimed a change without including board_update")
            if board_update is not None:
                if not isinstance(board_update, dict):
                    raise ValueError("board_update must be an object")
                if "name" in board_update:
                    name = board_update["name"]
                    if not isinstance(name, str) or not name.strip():
                        raise ValueError("board name must be a non-empty string")
                if "columns" in board_update:
                    columns = board_update["columns"]
                    if not isinstance(columns, list) or not columns:
                        raise ValueError("columns must be a non-empty array")
                    for column in columns:
                        if not isinstance(column, dict):
                            raise ValueError("column updates must be objects")
                        column_id = column.get("id")
                        if not isinstance(column_id, str) or not column_id.strip():
                            raise ValueError("column updates require a non-empty id")
                        name = column.get("name")
                        if name is not None and (not isinstance(name, str) or not name.strip()):
                            raise ValueError("column names must be non-empty strings")
                        cards = column.get("cards")
                        if cards is not None:
                            if not isinstance(cards, list):
                                raise ValueError("column cards must be an array")
                            for card in cards:
                                if not isinstance(card, dict):
                                    raise ValueError("card updates must be objects")
                                card_id = card.get("id")
                                if not isinstance(card_id, str) or not card_id.strip():
                                    raise ValueError("card updates require a non-empty id")
                                card_title = card.get("title")
                                if not isinstance(card_title, str) or not card_title.strip():
                                    raise ValueError("card updates require a non-empty title")
            return AiChatResponse(assistant_message=assistant_message, board_update=board_update)
        except (KeyError, TypeError, ValueError, ValidationError):
            if is_last_attempt:
                raise HTTPException(status_code=502, detail="Groq returned an invalid board update.") from None
            continue

    raise AssertionError("unreachable")


@app.post("/api/auth/signup", response_model=UserResponse, status_code=201, dependencies=[Depends(enforce_auth_rate_limit)])
def signup(payload: SignupRequest, response: Response) -> UserResponse:
    try:
        user = repository.create_user(payload.username, payload.password)
    except UsernameTakenError as error:
        raise HTTPException(status_code=409, detail="Username is already taken") from error
    token = repository.create_session(user.id)
    _set_session_cookie(response, token)
    return user


@app.post("/api/auth/login", response_model=UserResponse, dependencies=[Depends(enforce_auth_rate_limit)])
def login(payload: LoginRequest, response: Response) -> UserResponse:
    user = repository.authenticate_user(payload.username, payload.password)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = repository.create_session(user.id)
    _set_session_cookie(response, token)
    return user


@app.post("/api/auth/logout")
def logout(response: Response, kanban_session: str | None = Cookie(default=None)) -> dict[str, bool]:
    if kanban_session is not None:
        repository.delete_session(kanban_session)
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
    return {"ok": True}


@app.get("/api/auth/me", response_model=UserResponse)
def me(user: UserResponse = Depends(get_current_user)) -> UserResponse:
    return user


@app.post("/api/auth/forgot-password", response_model=ForgotPasswordResponse, dependencies=[Depends(enforce_auth_rate_limit)])
def forgot_password(payload: ForgotPasswordRequest) -> ForgotPasswordResponse:
    token = repository.create_password_reset(payload.username)
    return ForgotPasswordResponse(message="If that account exists, a reset link has been generated.", reset_token=token)


@app.post("/api/auth/reset-password", dependencies=[Depends(enforce_auth_rate_limit)])
def reset_password(payload: ResetPasswordRequest) -> dict[str, bool]:
    success = repository.reset_password(payload.token, payload.new_password)
    if not success:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    return {"ok": True}


@app.get("/api/boards", response_model=list[BoardSummary])
def list_boards(user: UserResponse = Depends(get_current_user)) -> list[BoardSummary]:
    return repository.list_boards(user.id)


@app.post("/api/boards", response_model=BoardResponse, status_code=201)
def create_board(payload: CreateBoardRequest, user: UserResponse = Depends(get_current_user)) -> BoardResponse:
    return repository.create_board(user.id, payload.name)


@app.get("/api/boards/{board_id}", response_model=BoardResponse)
def get_board(board_id: str, user: UserResponse = Depends(get_current_user)) -> BoardResponse:
    return repository.get_board(user.id, board_id)


@app.put("/api/boards/{board_id}", response_model=BoardResponse)
def update_board(board_id: str, board: BoardUpdate, user: UserResponse = Depends(get_current_user)) -> BoardResponse:
    return repository.save_board(user.id, board_id, board)


@app.patch("/api/boards/{board_id}", response_model=BoardResponse)
def rename_board(board_id: str, payload: CreateBoardRequest, user: UserResponse = Depends(get_current_user)) -> BoardResponse:
    return repository.rename_board(user.id, board_id, payload.name)


@app.delete("/api/boards/{board_id}", status_code=204)
def delete_board(board_id: str, user: UserResponse = Depends(get_current_user)) -> Response:
    repository.delete_board(user.id, board_id)
    return Response(status_code=204)
