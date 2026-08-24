# Backend Guidance

The `backend/` directory contains the FastAPI service for board persistence and the optional AI assistant.

- `app/main.py` owns the health endpoint, smoke-test page, board API, Groq connectivity check, and structured chat endpoint.
- `tests/` contains backend unit tests using FastAPI's `TestClient`.
- `pyproject.toml` / `uv.lock` pin runtime and dev dependencies; managed with uv (`uv sync`, `uv run ...`), not pip.
- `Dockerfile` builds the service for the repository Compose setup, using the uv base image to install dependencies.
- `README.md` documents direct Python and Docker startup paths.

- Board data is persisted through the repository boundary in the local JSON store; tests use temporary stores.
- Groq access is backend-only, via `https://api.groq.com/openai/v1/chat/completions` (OpenAI-compatible). Never expose `GROQ_API_KEY` to the browser, tests, logs, or committed files.
- The configured model is `openai/gpt-oss-20b` unless `GROQ_MODEL` overrides it, sent with `reasoning_effort: "low"` to keep latency down. Provider calls must retain timeout and clear provider-error handling.
- `/api/ai/check` and `/api/ai/chat` have no authentication; both are behind `enforce_ai_rate_limit` (in-memory, per-client-IP, 10 req/min) and requests to Groq carry a `max_tokens` cap. These exist specifically so a caller who bypasses the frontend sign-in can't burn through Groq's daily free-tier request quota on its own.
- AI responses are structured JSON. Validate the assistant response before applying any board update.
- Demo sign-in is not production authentication or authorization.