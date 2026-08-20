# Backend Guidance

The `backend/` directory contains the FastAPI service introduced in Part 2.

- `app/main.py` owns the health endpoint, hello-world API route, and smoke-test HTML page.
- `tests/` contains backend unit tests using FastAPI's `TestClient`.
- `requirements.txt` pins the runtime and test dependencies.
- `Dockerfile` builds the service for the repository Compose setup.
- `README.md` documents direct Python and Docker startup paths.

Keep this service minimal until the JSON data model is approved in Part 5. Do not add authentication, persistence, or AI behavior during scaffolding.