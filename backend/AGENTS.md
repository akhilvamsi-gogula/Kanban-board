# Backend Guidance

The `backend/` directory contains the FastAPI service for board persistence and the optional AI assistant.

- `app/main.py` owns the health endpoint, smoke-test page, board API, OpenRouter connectivity check, and structured chat endpoint.
- `tests/` contains backend unit tests using FastAPI's `TestClient`.
- `pyproject.toml` / `uv.lock` pin runtime and dev dependencies; managed with uv (`uv sync`, `uv run ...`), not pip.
- `Dockerfile` builds the service for the repository Compose setup, using the uv base image to install dependencies.
- `README.md` documents direct Python and Docker startup paths.

- Board data is persisted through the repository boundary in the local JSON store; tests use temporary stores.
- OpenRouter access is backend-only. Never expose `OPENROUTER_API_KEY` to the browser, tests, logs, or committed files.
- The configured model is `openai/gpt-oss-20b:free` unless `OPENROUTER_MODEL` overrides it. Provider calls must retain timeout and clear provider-error handling.
- AI responses are structured JSON. Validate the assistant response before applying any board update.
- Demo sign-in is not production authentication or authorization.