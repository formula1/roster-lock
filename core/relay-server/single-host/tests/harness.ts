import { join } from "path";
import { createProcessHarness, RelayHarness, RelayHarnessConfig } from "@roster-lock/relay-conformance";

const PACKAGE_DIR = join(__dirname, "..");

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
