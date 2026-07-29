import { runToCompletion, ProcessGroup } from "./lib/process-utils";
import { ENV_VARS_DIR, FULL_LOCAL_DIR } from "./constants";
import { loadEnvVars, requireEnv } from "./lib/env";

export type ServerSetupConfig = {
  publicRelayServerUrl: string,
  publicMatchmakerUrl: string,
  gameCoordinatorUrl: string,
  initialAdminUsername: string,
  initialAdminPassword: string,
  gameCoordinatorId: string,
  coordinatorApiKey: string,
};

export async function runServers(){
  const envVars = loadEnvVars(ENV_VARS_DIR);
  const processes = new ProcessGroup();
  processes.registerCleanupOnSignals(dockerComposeDown);

  const serversConfig = {
    publicRelayServerUrl: envVars.PUBLIC_RELAY_SERVER_URL,
    publicMatchmakerUrl: envVars.PUBLIC_MATCHMAKER_URL,
    gameCoordinatorUrl: envVars.GAME_COORDINATOR_URL,
    initialAdminUsername: envVars.INITIAL_ADMIN_USERNAME,
    initialAdminPassword: envVars.INITIAL_ADMIN_PASSWORD,
    gameCoordinatorId: envVars.GAME_COORDINATOR_ID,
    coordinatorApiKey: envVars.COORDINATOR_API_KEY,
  }
  try {
    await dockerComposeUp();
    await setupServers(serversConfig);
    console.log("Servers are up and registered. Press Ctrl+C to stop.");
    await keepAliveUntilSignal();
  } catch(err){
    await processes.cleanup(dockerComposeDown);
    throw err;
  }
}

/**
 * Blocks forever so the process doesn't exit as soon as setup finishes -
 * process.on("SIGINT"/"SIGTERM") listeners alone don't keep Node's event
 * loop alive. The registerCleanupOnSignals() handlers above are what
 * actually tear things down and call process.exit() once a signal arrives.
 */
function keepAliveUntilSignal(): Promise<never> {
  return new Promise(()=>{
    setInterval(()=>{}, 1 << 30);
  });
}

export async function dockerComposeUp(){
  console.log("Starting docker compose services (download-provider, relay-room, match-maker, game-coordinator)...");
  const composeExit = await runToCompletion(
    "docker-compose", "docker", ["compose", "up", "-d", /* "--build", */ "--wait"], { cwd: FULL_LOCAL_DIR }
  );
  if(composeExit !== 0) throw new Error("docker compose up failed");
}

export function dockerComposeDown(){
  console.log("Stopping docker compose services (download-provider, relay-room, match-maker, game-coordinator)...");
  return runToCompletion("docker-compose", "docker", ["compose", "down"], { cwd: FULL_LOCAL_DIR });
}


export async function setupServers(config: ServerSetupConfig){
  const { token: jwt } = await loginIntoRelayRoom(config, {
    username: config.initialAdminUsername,
    password: config.initialAdminPassword,
  });

  const { publicKey } = await getMatchMakerPublicKey(config);
  await ensureMatchMakerRegistered(config, jwt, { name: "Simple Battle Matchmaking", publicKey });

  await ensureGameCoordinatorRegistered(config, jwt, {
    id: config.gameCoordinatorId,
    name: "Simple WebRTC Connector",
    success_webhook_url: `${config.gameCoordinatorUrl}/webhook/room-complete`,
    failure_webhook_url: `${config.gameCoordinatorUrl}/webhook/room-failure`,
    api_key: config.coordinatorApiKey,
  })
}

async function loginIntoRelayRoom(config: ServerSetupConfig, body: { username: string, password: string }){
  const response = await fetch(`${config.publicRelayServerUrl}/api/v1/admin/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  const json = await response.json();
  if(!response.ok) throw new ErrorWithDetails("Failed to Login", json);
  return json as {
    token: string,
    passwordExpired: boolean,
  }
}

async function getMatchMakerPublicKey(config: ServerSetupConfig){
  const response = await fetch(`${config.publicMatchmakerUrl}/public-key`);
  const json = await response.json();
  if(!response.ok) throw new ErrorWithDetails("Failed to get public key", json);
  return json as { publicKey: string };
}

// matchmakers.name is UNIQUE in the relay's schema, and this always registers
// under the same fixed name - so a second run against a relay-room that
// wasn't cleanly torn down (docker compose down; relay-room keeps its SQLite
// data across a plain stop/start since it's not backed by a volume) would
// otherwise hit a constraint violation. Reuse the existing registration
// instead of re-inserting.
async function ensureMatchMakerRegistered(config: ServerSetupConfig, jwt: string, body: { name: string, publicKey: string }){
  const existing = (await listMatchMakers(config, jwt)).find(m => m.name === body.name);
  if(existing){
    if(existing.public_key !== body.publicKey){
      throw new ErrorWithDetails(
        `Matchmaker "${body.name}" is already registered with a different public key - ` +
        `if the matchmaker's keys were regenerated, run "docker compose down" first to clear the relay's old registration`,
        { existingId: existing.id }
      );
    }
    return existing;
  }
  return addMatchMakerToRelay(config, jwt, body);
}

async function listMatchMakers(config: ServerSetupConfig, jwt: string){
  const response = await fetch(`${config.publicRelayServerUrl}/api/v1/matchmaker`, {
    headers: { "Authorization": `Bearer ${jwt}` },
  })
  const json = await response.json();
  if(!response.ok) throw new ErrorWithDetails("Failed to list matchmakers", json);
  return json as Array<{ id: string, name: string, public_key: string }>;
}

async function addMatchMakerToRelay(config: ServerSetupConfig, jwt: string, body: { name: string, publicKey: string }){
  const response = await fetch(`${config.publicRelayServerUrl}/api/v1/matchmaker`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${jwt}`,
    },
    body: JSON.stringify(body),
  })
  const json = await response.json();
  if(!response.ok) throw new ErrorWithDetails("Failed to add matchmaker to relay", json);
  return json as { id: string, name: string, publicKey: string };
}

// game_coordinators.id is the PRIMARY KEY and .name is also UNIQUE, and this
// always registers under the same fixed id/name - same story as
// ensureMatchMakerRegistered above. Webhook URLs and the API key are static
// (derived from env vars), so an existing registration is always equivalent
// to what this run would send - just reuse it.
async function ensureGameCoordinatorRegistered(config: ServerSetupConfig, jwt: string,
  body: {
    id: string, name: string,
    success_webhook_url: string, failure_webhook_url: string,
    api_key: string
  }
){
  const existing = await getGameCoordinator(config, jwt, body.id);
  if(existing) return existing;
  return addGameCoordinatorToRelay(config, jwt, body);
}

async function getGameCoordinator(config: ServerSetupConfig, jwt: string, id: string){
  const response = await fetch(`${config.publicRelayServerUrl}/api/v1/game-coordinator/${id}`, {
    headers: { "Authorization": `Bearer ${jwt}` },
  })
  if(response.status === 404) return null;
  const json = await response.json();
  if(!response.ok) throw new ErrorWithDetails("Failed to look up game coordinator", json);
  return json as { id: string, name: string };
}

async function addGameCoordinatorToRelay(config: ServerSetupConfig, jwt: string,
  body: {
    id: string, name: string,
    success_webhook_url: string, failure_webhook_url: string,
    api_key: string
  }
){
  const response = await fetch(`${config.publicRelayServerUrl}/api/v1/game-coordinator`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${jwt}`,
    },
    body: JSON.stringify(body),
  })
  const json = await response.json();
  if(!response.ok) throw new ErrorWithDetails("Failed to add game coordinator to relay", json);
  return json as { id: string, name: string };
}

class ErrorWithDetails {
  constructor(public message: string, public details: any){}
}
