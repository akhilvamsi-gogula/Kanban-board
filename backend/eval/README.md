# AI co-pilot eval

`ai_eval.py` is a manual regression suite for the AI co-pilot's actual behavior against the real Groq model. It is deliberately **not** part of `uv run pytest` and **not** run in CI: every request costs Groq free-tier quota, and model responses are non-deterministic, so it isn't suitable as a merge gate.

`backend/tests/test_main.py` already proves the backend handles every possible response *shape* correctly (malformed JSON, a missing `board_update`, a wrong field name, a timeout) by mocking the Groq HTTP call. This script instead asks whether the *current, real* model still does the sensible thing for a small set of representative prompts, so it catches silent model drift (e.g. Groq updating `openai/gpt-oss-20b` under the hood) or a system-prompt regression that mocked tests can't see.

## Running it

Start the backend locally with `GROQ_API_KEY` configured (see the root `CLAUDE.md`), then from `backend/`:

```bash
uv run python eval/ai_eval.py
# or, if the backend is running somewhere else:
uv run python eval/ai_eval.py --base-url http://127.0.0.1:8001
```

It prints a PASS/FAIL line and the assistant's actual message for each case, and exits non-zero if anything failed.

## When to run it

- After changing the system prompt in `app/main.py`'s `ai_chat`.
- After changing `GROQ_MODEL` or picking up a Groq-side model update.
- After changing `board_update` validation.
- Periodically, as a spot-check for silent model drift.

## What the cases cover

- Ordinary requests: rename a column, add a card, remove a card.
- A pure question that should produce **no** `board_update` (checks the model isn't over-eager to change the board when nothing was asked).
- A guardrail probe: asking the model to add extra columns, which it must refuse (the app enforces exactly 5 columns elsewhere too, but this checks whether the model itself tries to comply with a request that violates that rule).
- An adversarial prompt with an HTML-looking card title, confirming the backend stores it as a literal string rather than mangling it (the frontend is responsible for safe rendering; this only checks the backend's data contract).

A failure here doesn't necessarily mean the app is broken end-to-end - for example, an invented extra column would still get rejected when the frontend tries to save the full board via `PUT /api/boards/{id}` (which strictly enforces exactly 5 columns). It means the *AI layer's own* guardrail didn't hold, which is worth knowing and fixing at the source rather than relying on the save path to catch it.
