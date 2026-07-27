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

  const machineId = process.env["USER_ID"] ?? crypto.randomUUID();
  const displayName = process.env["DISPLAY_NAME"] ?? `Player-${machineId.slice(0, 8)}`;
  const keys = await generateKeyPair();

  // This example harness runs one local player per machine - the matchmaker
  // assumes playerCount: 1 for every machine, and no example client here
  // yet drives a multi-controller UI.
  const user = { machineId, displayName, keys };

  console.log(`Starting headless game as "${displayName}" (${machineId})`);
  console.log(`Using roster config from: ${configPath}`);

  try {
    const result = await runSteps(user, rosterConfig);
    console.log("Game finished successfully.");
    // Marker line an orchestrator (e.g. integration/src/run-game.ts) can grep out of this
    // process's stdout to cross-check winners/turnCount/randomSeed against other players.
    console.log("GAME_RESULT " + JSON.stringify(result));
  } catch (err) {
    console.error("Game failed:", err);
    process.exit(1);
  }
}

main();
