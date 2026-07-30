import * as os from "os";
import * as path from "path";
import { ProcessGroup } from "./lib/process-utils";
import { loadEnvVars } from "./lib/env";
import { setupServers, dockerComposeUp, dockerComposeDown } from "./setupServers";
import { startMatchAgent, runPlayers } from "./run-game";

import { ENV_VARS_DIR } from "./constants";

const MATCH_AGENT_CONFIG = {
  port: String(58732),
  authCode: "abc123"
};

/** Full pipeline: docker compose up, match-agent, server-setup, N game-headless players, teardown. */
export async function runIntegration(numPlayers: number){
  const processes = new ProcessGroup();
  processes.registerCleanupOnSignals(dockerComposeDown);

  try {
    const envVars = loadEnvVars(ENV_VARS_DIR);

    await dockerComposeUp();

    const piecesFolder = processes.mkTempDir(path.join(os.tmpdir(), "roster-lock-pieces-"));
    await startMatchAgent(processes, { ...MATCH_AGENT_CONFIG, folder: piecesFolder });

    console.log("Registering matchmaker and game coordinator with the relay...");
    await setupServers({
      publicRelayServerUrl: envVars.PUBLIC_RELAY_SERVER_URL,
      publicMatchmakerUrl: envVars.PUBLIC_MATCHMAKER_URL,
      gameCoordinatorUrl: envVars.GAME_COORDINATOR_URL,
      initialAdminUsername: envVars.INITIAL_ADMIN_USERNAME,
      initialAdminPassword: envVars.INITIAL_ADMIN_PASSWORD,
      gameCoordinatorId: envVars.GAME_COORDINATOR_ID,
      coordinatorApiKey: envVars.COORDINATOR_API_KEY,
    });
    console.log("Server setup complete: matchmaker and game coordinator registered with relay.");

    await runPlayers(processes, numPlayers, MATCH_AGENT_CONFIG, {
      matchmaker: envVars.PUBLIC_MATCHMAKER_URL,
      relayRoom: envVars.PUBLIC_RELAY_SERVER_URL,
      gameCoordinator: envVars.PUBLIC_GAME_COORDINATOR_URL
    })

    await processes.cleanup(dockerComposeDown);
  } catch(err){
    console.error("Integration run failed:", err);
    await processes.cleanup(dockerComposeDown);
    throw err;
  }
}
