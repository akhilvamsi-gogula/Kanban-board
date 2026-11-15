import os
import threading
import time
from collections import deque

from fastapi import Depends, HTTPException, Request

from .deps import get_current_user
from .models import UserResponse


class RateLimiter:
    """Sliding-window limit of `max_requests` per `window_seconds` per key, in memory.

    In-memory is enough for this app's single Render instance; it resets on restart."""

    def __init__(self, max_requests: int, window_seconds: float, detail: str) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.detail = detail
        self._log: dict[str, deque[float]] = {}
        self._lock = threading.Lock()
        self._hits_since_sweep = 0

    def hit(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            self._sweep(now)
            timestamps = self._log.setdefault(key, deque())
            while timestamps and now - timestamps[0] > self.window_seconds:
                timestamps.popleft()
            if len(timestamps) >= self.max_requests:
                raise HTTPException(status_code=429, detail=self.detail)
            timestamps.append(now)

    def _sweep(self, now: float) -> None:
        # Drop keys with no recent requests now and then, so one-off visitors don't
        # accumulate in memory for the life of the process.
        self._hits_since_sweep += 1
        if self._hits_since_sweep < 500:
            return
        self._hits_since_sweep = 0
        stale = [key for key, timestamps in self._log.items() if not timestamps or now - timestamps[-1] > self.window_seconds]
        for key in stale:
            del self._log[key]

    def reset(self) -> None:
        with self._lock:
            self._log.clear()


# Sign-up/login/password-reset are unauthenticated by nature, so they're limited per client IP.
# In production uvicorn runs with --proxy-headers --forwarded-allow-ips="*", so request.client
# is the visitor's IP from X-Forwarded-For (which Vercel sets) rather than the proxy's IP -
# otherwise every visitor would share one bucket. The env override exists for the e2e suite,
# where every test signs up from 127.0.0.1.
auth_limiter = RateLimiter(
    int(os.getenv("KANBAN_AUTH_RATE_LIMIT", "20")), 60, "Too many requests. Please wait a moment and try again."
)

# AI endpoints are limited per signed-in account, so one user can't spend the whole app's
# shared Groq free-tier quota.
ai_limiter = RateLimiter(10, 60, "Too many AI requests. Please wait a moment and try again.")


def enforce_auth_rate_limit(request: Request) -> None:
    auth_limiter.hit(request.client.host if request.client else "unknown")


def ai_user(user: UserResponse = Depends(get_current_user)) -> UserResponse:
    ai_limiter.hit(user.id)
    return user
