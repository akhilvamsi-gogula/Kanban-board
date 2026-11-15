import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://127.0.0.1:3000", trace: "on-first-retry" },
  webServer: [
    { command: "npm run dev", url: "http://127.0.0.1:3000", reuseExistingServer: true },
    {
      command: "uv run --directory ../backend uvicorn app.main:app --host 127.0.0.1 --port 8000",
      url: "http://127.0.0.1:8000/health",
      reuseExistingServer: true,
      // Every test signs up from 127.0.0.1, which would exceed the default 20 auth requests/min.
      // A backend you started yourself needs this too: KANBAN_AUTH_RATE_LIMIT=1000.
      env: { KANBAN_AUTH_RATE_LIMIT: "1000" },
    },
  ],
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"] } },
    { name: "android", use: { ...devices["Pixel 7"] } },
  ],
});
