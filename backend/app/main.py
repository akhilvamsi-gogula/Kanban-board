import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from .models import BoardResponse, BoardUpdate
from .repository import DEFAULT_DATA_PATH, DataStoreError, KanbanRepository

app = FastAPI(title="Kanban Backend", version="0.1.0")
repository = KanbanRepository(Path(os.environ["KANBAN_DATA_PATH"]) if "KANBAN_DATA_PATH" in os.environ else DEFAULT_DATA_PATH)
cors_origins = [origin for origin in os.getenv("KANBAN_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if origin]
app.add_middleware(CORSMiddleware, allow_origins=cors_origins, allow_methods=["GET", "PUT"], allow_headers=["Content-Type"])


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
