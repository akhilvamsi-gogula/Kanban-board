import os
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
import json
from pydantic import ValidationError

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

from .models import AiChatRequest, AiChatResponse, BoardResponse, BoardUpdate
from .repository import DEFAULT_DATA_PATH, DataStoreError, KanbanRepository

app = FastAPI(title="Kanban Backend", version="0.1.0")
repository = KanbanRepository(Path(os.environ["KANBAN_DATA_PATH"]) if "KANBAN_DATA_PATH" in os.environ else DEFAULT_DATA_PATH)
cors_origins = [origin for origin in os.getenv("KANBAN_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if origin]
app.add_middleware(CORSMiddleware, allow_origins=cors_origins, allow_methods=["GET", "POST", "PUT"], allow_headers=["Content-Type"])


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


@app.get("/", response_class=HTMLResponse)
def smoke_test_page() -> str:
    return SMOKE_TEST_PAGE


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/hello")
def hello() -> dict[str, str]:
    return {"message": "Hello from the Kanban backend"}


@app.get("/api/ai/check")
def ai_connectivity_check() -> dict[str, object]:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="OPENROUTER_API_KEY is not configured.")

    model = os.getenv("OPENROUTER_MODEL", "openai/gpt-oss-20b:free")
    timeout_ms = int(os.getenv("OPENROUTER_TIMEOUT_MS", "15000"))
    prompt = "Compute 2 + 2 and answer only with a single number."

    try:
        response = httpx.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=timeout_ms / 1000,
        )
    except httpx.TimeoutException as error:
        raise HTTPException(status_code=504, detail=f"OpenRouter request timed out after {timeout_ms}ms.") from error
    except httpx.HTTPError as error:
        raise HTTPException(status_code=502, detail=f"OpenRouter request failed: {error}") from error

    try:
        payload = response.json()
        content = payload["choices"][0]["message"]["content"]
        answer = str(content).strip()
    except (KeyError, IndexError, TypeError, ValueError):
        raise HTTPException(status_code=502, detail="OpenRouter response was malformed.") from None

    if not answer:
        raise HTTPException(status_code=502, detail="OpenRouter response was malformed.")

    return {"ok": True, "answer": answer}


@app.post("/api/ai/chat", response_model=AiChatResponse)
def ai_chat(payload: AiChatRequest) -> AiChatResponse:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="OPENROUTER_API_KEY is not configured.")

    model = os.getenv("OPENROUTER_MODEL", "openai/gpt-oss-20b:free")
    timeout_ms = int(os.getenv("OPENROUTER_TIMEOUT_MS", "15000"))
    timeout_seconds = timeout_ms / 1000

    board_payload = payload.board.model_dump(mode="json") if payload.board else None
    history_payload = [message.model_dump(mode="json") for message in payload.history[-8:]]

    system_prompt = (
        "You are a Kanban assistant. Reply with JSON only and never send markdown. "
        "The JSON must have exactly two fields: assistant_message and optional board_update. "
        "If the user asks for a board change, include a valid board_update object using the same schema as the current board. "
        "Only make safe edits to the existing board: rename columns, rename cards, add or remove cards, and reorder cards within or across columns. "
        "Never invent new cards, IDs, or columns. Preserve all existing card IDs. "
        "If no board change is needed, omit board_update."
    )

    messages = [{"role": "system", "content": system_prompt}]
    if history_payload:
        messages.extend(history_payload)
    messages.append({"role": "user", "content": payload.prompt})
    if board_payload is not None:
        messages.append({"role": "user", "content": f"Current board JSON: {board_payload}"})

    try:
        response = httpx.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": messages,
                "reasoning": {"exclude": True},
            },
            timeout=timeout_seconds,
        )
    except httpx.TimeoutException as error:
        raise HTTPException(status_code=504, detail=f"OpenRouter request timed out after {timeout_ms}ms.") from error
    except httpx.HTTPError as error:
        raise HTTPException(status_code=502, detail=f"OpenRouter request failed: {error}") from error

    if response.status_code == 429:
        raise HTTPException(status_code=429, detail="OpenRouter rate limit reached. Please try again shortly.")
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"OpenRouter returned HTTP {response.status_code}.")

    try:
        payload_json = response.json()
        content = payload_json["choices"][0]["message"]["content"]
        parsed = json.loads(str(content).strip())
    except (KeyError, IndexError, TypeError, ValueError):
        raise HTTPException(status_code=502, detail="OpenRouter response was malformed.") from None

    try:
        assistant_message = str(parsed["assistant_message"]).strip()
        if not assistant_message:
            raise ValueError("missing message")
        board_update = parsed.get("board_update")
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
        return AiChatResponse(assistant_message=assistant_message, board_update=board_update)
    except (KeyError, TypeError, ValueError, ValidationError):
        raise HTTPException(status_code=502, detail="OpenRouter returned an invalid board update.") from None


@app.get("/api/users/{user_id}/board", response_model=BoardResponse)
def get_user_board(user_id: str) -> BoardResponse:
  try:
    board = repository.get_board(user_id)
  except DataStoreError as error:
    raise HTTPException(status_code=500, detail=str(error)) from error
  if board is None:
    raise HTTPException(status_code=404, detail="User not found")
  return board


@app.put("/api/users/{user_id}/board", response_model=BoardResponse)
def update_user_board(user_id: str, board: BoardUpdate) -> BoardResponse:
  try:
    updated_board = repository.save_board(user_id, board)
  except DataStoreError as error:
    raise HTTPException(status_code=500, detail=str(error)) from error
  if updated_board is None:
    raise HTTPException(status_code=404, detail="User not found")
  return updated_board
