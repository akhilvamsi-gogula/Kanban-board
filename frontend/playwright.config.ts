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
    { name: "iphone-13", use: { ...devices["iPhone 13"] } }, // WebKit, 390 x 664
    { name: "pixel-7", use: { ...devices["Pixel 7"] } }, // Chromium, 412 x 839
    {
      // Playwright has no built-in S24 Ultra profile; these are the phone's real CSS viewport
      // and pixel ratio. It is the narrowest of the three phones, so layout bugs show here first.
      name: "galaxy-s24-ultra",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 384, height: 824 },
        deviceScaleFactor: 3.75,
        userAgent: "Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
      },
    },
  ],
});
