import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

from .repository import BoardNotFoundError, CannotDeleteLastBoardError, DataStoreError, KanbanRepository  # noqa: E402
from .routers import ai, auth, boards  # noqa: E402


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Created at startup rather than import time, so importing the app (tests, tooling)
    # doesn't need a database. Tests set app.state.repository themselves.
    app.state.repository = KanbanRepository(os.environ["DATABASE_URL"])
    try:
        yield
    finally:
        app.state.repository.close()


app = FastAPI(title="Kanban Backend", version="0.1.0", lifespan=lifespan)
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

app.include_router(auth.router)
app.include_router(boards.router)
app.include_router(ai.router)


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


@app.get("/api/health")
def api_health() -> dict[str, str]:
    # Same as /health, but under /api so the frontend can reach it through its /backend-api/*
    # rewrite. Polled by the wake-up screen while Render's free tier boots the service, so it
    # must not touch the database.
    return {"status": "ok"}


@app.get("/api/hello")
def hello() -> dict[str, str]:
    return {"message": "Hello from the Kanban backend"}
