import * as path from "path";
import { ProcessGroup, runToCompletion } from "./lib/process-utils";
import { loadEnvVars } from "./lib/env";
import { setupServers } from "./setupServers";
import { startMatchAgent, runPlayers } from "./run-game";

const FULL_LOCAL_DIR = path.resolve(__dirname, "../..");
const ENV_VARS_DIR = path.join(FULL_LOCAL_DIR, "services/env-vars");

const MATCH_AGENT_CONFIG = {
  port: String(58732),
  authCode: "abc123"
};
function dockerComposeDown(){
  return runToCompletion("docker-compose", "docker", ["compose", "down"], { cwd: FULL_LOCAL_DIR });
}

/** Full pipeline: docker compose up, match-agent, server-setup, N game-headless players, teardown. */
export async function runIntegration(numPlayers: number){
  const processes = new ProcessGroup();
  processes.registerCleanupOnSignals();

  try {
    const envVars = loadEnvVars(ENV_VARS_DIR);

    console.log("Starting docker compose services (download-provider, relay-room, match-maker, game-coordinator)...");
    const composeExit = await runToCompletion(
      "docker-compose", "docker", ["compose", "up", "-d", "--build", "--wait"], { cwd: FULL_LOCAL_DIR }
    );
    if(composeExit !== 0) throw new Error("docker compose up failed");

    await startMatchAgent(processes, MATCH_AGENT_CONFIG);

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
