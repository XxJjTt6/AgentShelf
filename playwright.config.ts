import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: "http://127.0.0.1:3010",
    channel: "chrome",
    trace: "retain-on-failure",
  },
  // The demo API keeps an in-memory scenario state, so end-to-end flows must not overlap.
  workers: 1,
  projects: [
    {
      name: "chrome",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } },
    },
  ],
  reporter: [["line"]],
});
