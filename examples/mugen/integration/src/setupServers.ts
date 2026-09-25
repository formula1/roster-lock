import { runToCompletion } from "./lib/process-utils";
import { MUGEN_DIR, ENV_VARS_DIR } from "./constants";
import { loadEnvVars } from "./lib/env";
import { loginIntoRelayRoom, ensureMatchMakerRegistered, ensureGameCoordinatorRegistered } from "./lib/relayAdmin";

export async function dockerComposeUp(){
  console.log("Starting docker compose services (download-provider, relay-room, auth-naive, titled-room, direct-ip-coordinator)...");
  const composeExit = await runToCompletion(
    "docker-compose", "docker", ["compose", "up", "-d", "--wait"], { cwd: MUGEN_DIR }
  );
  if(composeExit !== 0) throw new Error("docker compose up failed");
}

export function dockerComposeDown(){
  console.log("Stopping docker compose services...");
  return runToCompletion("docker-compose", "docker", ["compose", "down"], { cwd: MUGEN_DIR });
}

/**
 * Registers titled-room as a matchmaker and direct-ip-coordinator as a game
 * coordinator with relay-room's admin API. titled-room itself no longer has
 * an admin API of its own - which game launcher it allows (ikemen-go, the
 * only one it'll ever offer now that this service lives at
 * examples/mugen/services/titled-room) and its coordinator address are
 * hardcoded/env-configured (see titled-room's own game-launchers.ts and
 * internal-urls.env's GAME_COORDINATOR_ID/IKEMEN_COORDINATOR_TCP_HOST/PORT).
 */
export async function setupServers(){
  const env = loadEnvVars(ENV_VARS_DIR);
  const publicRelayServerUrl = requireEnv2(env, "PUBLIC_RELAY_SERVER_URL");

  console.log("Logging into relay-room admin...");
  const { token: relayJwt } = await loginIntoRelayRoom(publicRelayServerUrl, {
    username: requireEnv2(env, "INITIAL_ADMIN_USERNAME"),
    password: requireEnv2(env, "INITIAL_ADMIN_PASSWORD"),
  });

  console.log("Registering titled-room as a matchmaker with relay-room...");
  await ensureMatchMakerRegistered(publicRelayServerUrl, relayJwt, {
    name: "titled-room-mugen",
    publicKey: requireEnv2(env, "MATCHMAKER_PUBLIC_KEY"),
  });

  console.log("Registering direct-ip-coordinator as a game coordinator with relay-room...");
  await ensureGameCoordinatorRegistered(publicRelayServerUrl, relayJwt, {
    id: requireEnv2(env, "GAME_COORDINATOR_ID"),
    name: "Ikemen Direct-TCP Coordinator",
    success_webhook_url: `${requireEnv2(env, "IKEMEN_COORDINATOR_WEBHOOK_URL")}/webhook/room-complete`,
    failure_webhook_url: `${requireEnv2(env, "IKEMEN_COORDINATOR_WEBHOOK_URL")}/webhook/room-failure`,
    api_key: requireEnv2(env, "COORDINATOR_API_KEY"),
  });

  console.log("Server setup complete.");
}

// loadEnvVars merges *.env files into a plain object - lib/env.ts's
// requireEnv reads process.env instead, so this is the object-keyed
// equivalent.
function requireEnv2(env: Record<string, string>, name: string): string {
  const value = env[name];
  if(!value) throw new Error(`${name} is not defined in examples/mugen/services/env-vars/*.env`);
  return value;
}
