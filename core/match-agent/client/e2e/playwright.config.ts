import { defineConfig } from "@playwright/test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { MATCH_AGENT_PORT, MATCH_AGENT_AUTH_CODE, MATCH_AGENT_URL, CLIENT_PORT, CLIENT_URL, CONFIG_FILE_PATH } from "./lib/env";

// This package's own root (one level up from e2e/) - both webServer
// commands below run from here, not from e2e/ itself.
const packageRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");

// Covers only the shell app's own pages - Connect, the full-screen
// menu/NavBar, Join Settings, Game Launchers list, Controls, and Match
// Making's own controls - navigated with the keyboard/gamepad schemes
// GlobalNavContext drives (see e2e/tests). No plugins, Docker, or real
// game binaries are needed, unlike examples/mugen/playwright's full-infra
// suite: the embedded matchmaker <iframe> (titled-room/client) and the
// piece-selection grid inside it are out of scope here.
export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: CLIENT_URL,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: (
        `node ../dist/index.js listen --port ${MATCH_AGENT_PORT} --auth-code ${MATCH_AGENT_AUTH_CODE} ` +
        `--config-file ${CONFIG_FILE_PATH}`
      ),
      url: `${MATCH_AGENT_URL}/health`,
      reuseExistingServer: false,
      timeout: 20_000,
      cwd: packageRoot,
    },
    {
      command: `pnpm exec vite --port ${CLIENT_PORT} --strictPort`,
      url: CLIENT_URL,
      reuseExistingServer: false,
      timeout: 30_000,
      cwd: packageRoot,
    },
  ],
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
