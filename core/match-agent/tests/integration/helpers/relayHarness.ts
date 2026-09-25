import { dirname } from "path";
import { createProcessHarness, RelayHarness, RelayHarnessConfig } from "@roster-lock/relay-conformance";

// Same spawn recipe as single-host's own tests/harness.ts, but resolved from
// outside that package - this harness proves match-agent's real client works
// against a real single-host process, so it can't reuse single-host's
// __dirname-relative PACKAGE_DIR.
const PACKAGE_DIR = dirname(require.resolve("@roster-lock/relay-server-hosted/package.json"));

export function createSingleHostHarness(): RelayHarness {
  return createProcessHarness((port: number, config: RelayHarnessConfig) => ({
    command: "npx",
    args: ["tsx", "src/index.ts"],
    cwd: PACKAGE_DIR,
    env: {
      ...process.env,
      PORT: String(port),
      JWT_SECRET: config.jwtSecret,
      GAME_COORDINATOR_ENCRYPTION_KEY: config.gameCoordinatorEncryptionKey,
      INITIAL_ADMIN_USERNAME: config.initialAdmin.username,
      INITIAL_ADMIN_PASSWORD: config.initialAdmin.password,
    },
  }));
}
