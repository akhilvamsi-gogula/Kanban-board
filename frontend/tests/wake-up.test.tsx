import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "../app/page";
import { waitForBackend } from "../lib/api";
import { wakeProgress } from "../components/wake-up-screen";

type FakeResponse = { status: number } | "network-error" | "hang";

function respond(status: number, body: unknown = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

// health: what each successive GET /backend-api/health returns; the last entry repeats.
function stubBackend(health: FakeResponse[]) {
  const healthCalls: number[] = [];
  let release: (() => void) | undefined;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path.endsWith("/health")) {
      healthCalls.push(Date.now());
      const next = health[Math.min(healthCalls.length - 1, health.length - 1)];
      if (next === "network-error") throw new TypeError("Failed to fetch");
      if (next === "hang") {
        await new Promise<void>((resolve) => { release = resolve; });
        return respond(200, { status: "ok" });
      }
      return respond(next.status);
    }
    if (path.endsWith("/auth/me")) return respond(401, { detail: "Not authenticated" });
    throw new Error(`Unhandled request: ${path}`);
  }));
  return { healthCalls, release: () => release?.() };
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("waitForBackend", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("retries while the server is waking and resolves once it answers", async () => {
    const backend = stubBackend(["network-error", { status: 500 }, { status: 502 }, { status: 503 }, { status: 504 }, { status: 200 }]);
    await waitForBackend({ retryDelayMs: 1 });
    expect(backend.healthCalls).toHaveLength(6);
  });

  it("treats any non-5xx answer, such as a 404 from an older backend, as awake", async () => {
    const backend = stubBackend([{ status: 404 }]);
    await waitForBackend({ retryDelayMs: 1 });
    expect(backend.healthCalls).toHaveLength(1);
  });

  it("gives up after the timeout", async () => {
    stubBackend([{ status: 503 }]);
    await expect(waitForBackend({ timeoutMs: 30, retryDelayMs: 5 })).rejects.toThrow("did not respond");
  });
});

describe("wakeProgress", () => {
  it("moves steadily but never reaches 100% on its own", () => {
    expect(wakeProgress(0)).toBe(0);
    expect(wakeProgress(10)).toBeGreaterThan(30);
    expect(wakeProgress(50)).toBeGreaterThan(wakeProgress(10));
    expect(wakeProgress(600)).toBeLessThanOrEqual(95);
  });
});

describe("Home wake-up screen", () => {
  // SignIn is loaded with next/dynamic; load the module up front so its (real, not timer-driven)
  // import isn't still pending when these fake-timer tests look for the form.
  beforeAll(async () => {
    await import("../components/sign-in");
  });
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does not show the wake-up screen when the server answers quickly", async () => {
    stubBackend([{ status: 200 }]);
    render(<Home />);
    await advance(500);
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    await advance(3_000);
    expect(screen.queryByText("Waking up the server")).not.toBeInTheDocument();
  });

  it("shows progress while the server wakes, then continues to sign-in", async () => {
    const backend = stubBackend(["hang"]);
    render(<Home />);

    await advance(1_000);
    expect(screen.queryByText("Waking up the server")).not.toBeInTheDocument();

    await advance(1_500);
    expect(screen.getByText("Waking up the server")).toBeInTheDocument();
    const startProgress = Number(screen.getByRole("progressbar").getAttribute("aria-valuenow"));

    await advance(10_000);
    expect(screen.getByText("12s")).toBeInTheDocument();
    expect(Number(screen.getByRole("progressbar").getAttribute("aria-valuenow"))).toBeGreaterThan(startProgress);

    backend.release();
    await advance(100);
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.queryByText("Waking up the server")).not.toBeInTheDocument();
  });

  it("shows an error with a working retry when the server never answers", async () => {
    stubBackend([{ status: 503 }]);
    render(<Home />);

    await advance(91_000);
    expect(screen.getByText("The server is not responding")).toBeInTheDocument();

    stubBackend([{ status: 200 }]);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await advance(500);
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
  });
});
