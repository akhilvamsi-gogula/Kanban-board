# Backend Guidance

The `backend/` directory contains the FastAPI service for board persistence and the optional AI assistant.

- `app/main.py` owns the health endpoint, smoke-test page, board API, OpenRouter connectivity check, and structured chat endpoint.
- `tests/` contains backend unit tests using FastAPI's `TestClient`.
- `requirements.txt` pins the runtime and test dependencies.
- `Dockerfile` builds the service for the repository Compose setup.
- `README.md` documents direct Python and Docker startup paths.

- Board data is persisted through the repository boundary in the local JSON store; tests use temporary stores.
- OpenRouter access is backend-only. Never expose `OPENROUTER_API_KEY` to the browser, tests, logs, or committed files.
- The configured model is `openai/gpt-oss-20b:free` unless `OPENROUTER_MODEL` overrides it. Provider calls must retain timeout and clear provider-error handling.
- AI responses are structured JSON. Validate the assistant response before applying any board update.
- Demo sign-in is not production authentication or authorization.