"""Concurrent multi-user load check for the Kanban backend.

Simulates N people using the app at the same time, each with their own account: every
simulated user signs up, lists their boards, loads their board, saves it several times
(adding a card each time), and reloads it. It then checks that every user sees exactly
their own cards and nobody else's, and prints request latency percentiles.

Not part of `uv run pytest` - it needs a running backend and is about timing, not
correctness of a single request. Every user signs up from the same IP, so start the
backend with a raised auth rate limit (KANBAN_AUTH_RATE_LIMIT=1000) or sign-ups get 429s.

Usage (from backend/):
    uv run python scripts/load_check.py --users 25 [--saves 5] [--base-url http://127.0.0.1:8000]
"""

from __future__ import annotations

import argparse
import asyncio
import secrets
import statistics
import sys
import time

import httpx


class Timer:
    def __init__(self) -> None:
        self.samples: dict[str, list[float]] = {}

    async def request(self, client: httpx.AsyncClient, label: str, method: str, url: str, **kwargs) -> httpx.Response:
        started = time.perf_counter()
        response = await client.request(method, url, **kwargs)
        self.samples.setdefault(label, []).append((time.perf_counter() - started) * 1000)
        response.raise_for_status()
        return response


async def simulate_user(base_url: str, saves: int, timer: Timer) -> tuple[str, list[str], list[str]]:
    username = f"load-{secrets.token_hex(5)}"
    async with httpx.AsyncClient(base_url=base_url, timeout=60) as client:
        await timer.request(client, "signup", "POST", "/api/auth/signup", json={"username": username, "password": "load-check-pass"})
        boards = (await timer.request(client, "list boards", "GET", "/api/boards")).json()
        board_id = boards[0]["id"]
        board = (await timer.request(client, "get board", "GET", f"/api/boards/{board_id}")).json()
        expected: list[str] = []
        for index in range(saves):
            title = f"{username} card {index}"
            expected.append(title)
            cards = board["columns"][0]["cards"]
            cards.append({"id": f"c{index}-{secrets.token_hex(3)}", "title": title, "details": "", "position": len(cards)})
            payload = {"name": board["name"], "columns": board["columns"]}
            board = (await timer.request(client, "save board", "PUT", f"/api/boards/{board_id}", json=payload)).json()
        final = (await timer.request(client, "get board", "GET", f"/api/boards/{board_id}")).json()
        seen = [card["title"] for column in final["columns"] for card in column["cards"]]
    return username, expected, seen


def percentile(values: list[float], fraction: float) -> float:
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(round(fraction * (len(ordered) - 1))))]


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--users", type=int, default=5)
    parser.add_argument("--saves", type=int, default=5)
    args = parser.parse_args()

    timer = Timer()
    started = time.perf_counter()
    results = await asyncio.gather(*(simulate_user(args.base_url, args.saves, timer) for _ in range(args.users)), return_exceptions=True)
    wall_seconds = time.perf_counter() - started

    failures = [result for result in results if isinstance(result, BaseException)]
    isolation_errors = [
        f"{username}: expected {expected}, saw {seen}"
        for result in results
        if not isinstance(result, BaseException)
        for username, expected, seen in [result]
        if seen != expected
    ]

    print(f"{args.users} concurrent users x {args.saves} saves: {wall_seconds:.2f}s wall time")
    print(f"{'request':<12} {'count':>5} {'p50 ms':>8} {'p95 ms':>8} {'max ms':>8}")
    for label, samples in timer.samples.items():
        print(f"{label:<12} {len(samples):>5} {statistics.median(samples):>8.0f} {percentile(samples, 0.95):>8.0f} {max(samples):>8.0f}")
    for failure in failures[:5]:
        print(f"FAILED: {failure!r}")
    for error in isolation_errors[:5]:
        print(f"ISOLATION ERROR: {error}")
    ok = not failures and not isolation_errors
    print("RESULT:", "ok - every user saw exactly their own data" if ok else f"{len(failures)} failed, {len(isolation_errors)} isolation errors")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
