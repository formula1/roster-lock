import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  // Real docker services, real per-player match-agent subprocesses, a real
  // tar download over the relay, and a real Ikemen GO process - this is one
  // long infrastructure-backed scenario, not a fast unit-style suite.
  timeout: 20 * 60 * 1000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        // Headed, not headless - this suite launches real Ikemen GO windows
        // alongside the browser (needs a real display either way, same as
        // examples/mugen/integration/src/run.ts), so there's no headless/CI
        // path to preserve here.
        headless: false,
      },
    },
  ],
});
