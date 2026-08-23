import { runToCompletion } from "./lib/process-utils";
import { MUGEN_DIR, ENV_VARS_DIR } from "./constants";
import { loadEnvVars } from "./lib/env";
import { loginIntoRelayRoom, ensureMatchMakerRegistered, ensureGameCoordinatorRegistered } from "./lib/relayAdmin";
import { adminLogin, upsertGameLauncher } from "./lib/titledRoomAdmin";

const IKEMEN_PLUGIN_NAME = "@roster-lock/game-launcher-ikemen-go";

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
 * coordinator with relay-room's admin API, then registers ikemen-go as an
 * allowed game launcher with titled-room's own admin API (engineSha +
 * coordinator id/address) - replacing what used to be static
 * ALLOWED_GAME_RUNNERS/GAME_COORDINATORS env vars (see titled-room's
 * src/admin/game-launchers.ts).
 */
export async function setupServers(){
  const env = loadEnvVars(ENV_VARS_DIR);
  const publicRelayServerUrl = requireEnv2(env, "PUBLIC_RELAY_SERVER_URL");
  const publicTitledRoomUrl = requireEnv2(env, "PUBLIC_TITLED_ROOM_URL");

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
  const coordinatorId = requireEnv2(env, "GAME_COORDINATOR_ID");
  await ensureGameCoordinatorRegistered(publicRelayServerUrl, relayJwt, {
    id: coordinatorId,
    name: "Ikemen Direct-TCP Coordinator",
    success_webhook_url: `${requireEnv2(env, "IKEMEN_COORDINATOR_WEBHOOK_URL")}/webhook/room-complete`,
    failure_webhook_url: `${requireEnv2(env, "IKEMEN_COORDINATOR_WEBHOOK_URL")}/webhook/room-failure`,
    api_key: requireEnv2(env, "COORDINATOR_API_KEY"),
  });

  console.log("Logging into titled-room admin...");
  const titledRoomAdminToken = await adminLogin(
    publicTitledRoomUrl,
    requireEnv2(env, "TITLED_ROOM_ADMIN_USERNAME"),
    requireEnv2(env, "TITLED_ROOM_ADMIN_PASSWORD"),
  );

  console.log("Registering ikemen-go as an allowed game launcher with titled-room...");
  await upsertGameLauncher(publicTitledRoomUrl, titledRoomAdminToken, IKEMEN_PLUGIN_NAME, {
    engineSha: requireEnv2(env, "IKEMEN_ENGINE_SHA"),
    coordinator: {
      id: coordinatorId,
      address: {
        host: requireEnv2(env, "IKEMEN_COORDINATOR_TCP_HOST"),
        port: Number(requireEnv2(env, "IKEMEN_COORDINATOR_TCP_PORT")),
      },
    },
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
