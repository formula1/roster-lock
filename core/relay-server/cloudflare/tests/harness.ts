import { existsSync, mkdtempSync } from "fs";
import { rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { createProcessHarness, RelayHarness, RelayHarnessConfig } from "@roster-lock/relay-conformance";

const execFileAsync = promisify(execFile);
const PACKAGE_DIR = join(__dirname, "..");
const CLIENT_DIST_INDEX = join(PACKAGE_DIR, "../client-admin/dist/index.html");

export function createCloudflareHarness(): RelayHarness {
  return createProcessHarness((port: number, config: RelayHarnessConfig) => {
    // A fresh temp dir per run gives each test a clean D1/DO state - reusing
    // .wrangler/state would mean "bootstraps the initial admin" only passes
    // on the very first run.
    const persistDir = mkdtempSync(join(tmpdir(), "relay-cf-conformance-"));

    return {
      command: "npx",
      args: [
        "wrangler", "dev",
        "--port", String(port),
        "--persist-to", persistDir,
        "--var", `JWT_SECRET:${config.jwtSecret}`,
        "--var", `GAME_COORDINATOR_ENCRYPTION_KEY:${config.gameCoordinatorEncryptionKey}`,
        "--var", `INITIAL_ADMIN_USERNAME:${config.initialAdmin.username}`,
        "--var", `INITIAL_ADMIN_PASSWORD:${config.initialAdmin.password}`,
      ],
      cwd: PACKAGE_DIR,
      env: process.env,
      // wrangler dev's Workers runtime cold start is slower than a plain
      // tsx process - give it more room than the default.
      timeoutMs: 45_000,
      beforeSpawn: async () => {
        // wrangler's static asset binding refuses to start if its directory
        // doesn't exist yet - build the admin client once on a fresh checkout.
        if (!existsSync(CLIENT_DIST_INDEX)) {
          await execFileAsync("pnpm", ["run", "build:client"], { cwd: PACKAGE_DIR });
        }

        await execFileAsync("npx", [
          "wrangler", "d1", "execute", "roster-lock-db",
          "--local", "--persist-to", persistDir,
          "--file=./src/version-1/schema/tables.sql",
        ], { cwd: PACKAGE_DIR });
      },
      afterStop: async () => {
        await rm(persistDir, { recursive: true, force: true });
      },
    };
  });
}
