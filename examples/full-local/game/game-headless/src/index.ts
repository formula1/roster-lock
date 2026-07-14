import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { RosterLockV1Config } from "@roster-lock/types";
import { generateKeyPair } from "@roster-lock/ts-client";
import { runSteps } from "./steps";

async function main() {
  const configPath = process.env["MATCH_LOCK_CONFIG_PATH"]
    ?? path.resolve(__dirname, "../../match-lock-config.json");

  let rosterConfig: RosterLockV1Config;
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    rosterConfig = JSON.parse(raw) as RosterLockV1Config;
  } catch (err) {
    console.error(`Failed to load roster config from ${configPath}:`, err);
    process.exit(1);
  }

  const userId = process.env["USER_ID"] ?? crypto.randomUUID();
  const displayName = process.env["DISPLAY_NAME"] ?? `Player-${userId.slice(0, 8)}`;
  const keys = await generateKeyPair();

  const user = { userId, displayName, keys };

  console.log(`Starting headless game as "${displayName}" (${userId})`);
  console.log(`Using roster config from: ${configPath}`);

  try {
    await runSteps(user, rosterConfig);
    console.log("Game finished successfully.");
  } catch (err) {
    console.error("Game failed:", err);
    process.exit(1);
  }
}

main();
