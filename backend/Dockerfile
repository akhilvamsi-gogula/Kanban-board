FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY app ./app

EXPOSE 8000

# --no-sync: dependencies are already installed at build time, so skip uv's re-check on every
# boot (matters on Render's free tier, where every wake from sleep is a fresh boot).
# --proxy-headers/--forwarded-allow-ips: in production every request arrives through Vercel's
# rewrite and Render's proxy, so trust X-Forwarded-For for the client address; otherwise the
# per-IP sign-in rate limit sees the proxy's IP and all visitors share one bucket.
CMD ["uv", "run", "--no-sync", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
