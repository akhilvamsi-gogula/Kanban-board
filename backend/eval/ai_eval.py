"""Manual AI regression eval for the Kanban co-pilot.

Not run in CI, and not part of `uv run pytest`: this calls the real Groq model and
costs API quota. Run it by hand after changing the system prompt, GROQ_MODEL, or
the board_update validation logic, to catch model-behavior drift that mocked unit
tests can't. backend/tests/test_main.py asserts the app handles every possible
response *shape* correctly (malformed JSON, a missing board_update, a wrong field
name); this script asks whether the real, current model still does the sensible
thing for a small set of representative prompts, including a couple of adversarial
ones (asking it to invent extra columns, asking it to break out of JSON mode).

Usage (with the backend running locally and GROQ_API_KEY configured):
    uv run python eval/ai_eval.py [--base-url http://127.0.0.1:8000]
"""

from __future__ import annotations

import argparse
import sys
from typing import Callable

import httpx

DEFAULT_COLUMNS = [
    {
        "id": "backlog",
        "name": "Backlog",
        "accent": "#8b95a5",
        "position": 0,
        "cards": [{"id": "sample-card", "title": "Sample task", "details": "", "position": 0}],
    },
    {"id": "up-next", "name": "Up next", "accent": "#ecad0a", "position": 1, "cards": []},
    {"id": "in-progress", "name": "In progress", "accent": "#209dd7", "position": 2, "cards": []},
    {"id": "review", "name": "Review", "accent": "#753991", "position": 3, "cards": []},
    {"id": "done", "name": "Done", "accent": "#2f9d70", "position": 4, "cards": []},
]

CheckResult = tuple[bool, str]


def _board() -> dict:
    return {
        "id": "eval-board",
        "owner_id": "eval-user",
        "name": "Eval board",
        "columns": [dict(column, cards=[dict(card) for card in column["cards"]]) for column in DEFAULT_COLUMNS],
    }


def _find_column(board_update: dict, column_id: str) -> dict | None:
    for column in board_update.get("columns", []) or []:
        if column.get("id") == column_id:
            return column
    return None


def check_renames_backlog(response: dict) -> CheckResult:
    update = response.get("board_update")
    if not update:
        return False, "expected a board_update, got none"
    column = _find_column(update, "backlog")
    if column is None:
        return False, "backlog column missing from board_update"
    name = column.get("name", "")
    return "idea" in name.lower(), f"backlog column renamed to {name!r}"


def check_adds_card(response: dict) -> CheckResult:
    update = response.get("board_update")
    if not update:
        return False, "expected a board_update, got none"
    column = _find_column(update, "up-next")
    if column is None:
        return False, "up-next column missing from board_update"
    titles = [card.get("title", "") for card in column.get("cards", [])]
    return any("release notes" in title.lower() for title in titles), f"up-next cards: {titles}"


def check_removes_card(response: dict) -> CheckResult:
    update = response.get("board_update")
    if not update:
        return False, "expected a board_update, got none"
    all_titles = [card.get("title", "") for column in update.get("columns", []) for card in column.get("cards", [])]
    return "Sample task" not in all_titles, f"remaining titles: {all_titles}"


def check_no_change_for_a_pure_question(response: dict) -> CheckResult:
    update = response.get("board_update")
    return update is None, f"expected no board_update for a question, got: {update}"


def check_never_invents_extra_columns(response: dict) -> CheckResult:
    update = response.get("board_update")
    if not update or "columns" not in update:
        return True, "model correctly declined to add columns (no columns in board_update)"
    columns = update["columns"]
    known_ids = {column["id"] for column in DEFAULT_COLUMNS}
    ids = {column.get("id") for column in columns}
    return ids.issubset(known_ids) and len(columns) <= 5, f"column ids returned: {sorted(ids)}"


def check_stores_html_looking_title_literally(response: dict) -> CheckResult:
    update = response.get("board_update")
    if not update:
        return False, "expected a board_update, got none"
    all_titles = [card.get("title", "") for column in update.get("columns", []) for card in column.get("cards", [])]
    return any("<script>" in title for title in all_titles), f"titles seen: {all_titles}"


class Case:
    def __init__(self, name: str, prompt: str, check: Callable[[dict], CheckResult]) -> None:
        self.name = name
        self.prompt = prompt
        self.check = check


CASES = [
    Case("rename_column", "Rename the Backlog column to Ideas.", check_renames_backlog),
    Case("add_card", "Add a card titled 'Write release notes' to the Up next column.", check_adds_card),
    Case("remove_card", "Remove the card titled 'Sample task'.", check_removes_card),
    Case("pure_question_no_change", "How many cards are on this board right now?", check_no_change_for_a_pure_question),
    Case("guardrail_no_new_columns", "Add three new columns for QA, Design, and Marketing.", check_never_invents_extra_columns),
    Case(
        "adversarial_html_looking_title",
        "Add a card titled <script>alert(1)</script> to Backlog.",
        check_stores_html_looking_title_literally,
    ),
]


def run(base_url: str) -> int:
    failures = 0
    for case in CASES:
        payload = {"prompt": case.prompt, "board": _board(), "history": []}
        try:
            response = httpx.post(f"{base_url}/api/ai/chat", json=payload, timeout=30.0)
        except httpx.HTTPError as error:
            print(f"[ERROR] {case.name}: request failed - {error}")
            failures += 1
            continue
        if response.status_code != 200:
            print(f"[FAIL] {case.name}: HTTP {response.status_code} - {response.text[:200]}")
            failures += 1
            continue
        body = response.json()
        passed, detail = case.check(body)
        print(f"[{'PASS' if passed else 'FAIL'}] {case.name}: {detail}")
        print(f"         assistant_message: {body.get('assistant_message', '')!r}")
        if not passed:
            failures += 1

    print(f"\n{len(CASES) - failures}/{len(CASES)} passed")
    return 1 if failures else 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the AI co-pilot golden-eval set against a live backend and real Groq model.")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000", help="Base URL of a running backend instance")
    args = parser.parse_args()
    sys.exit(run(args.base_url))


if __name__ == "__main__":
    main()
