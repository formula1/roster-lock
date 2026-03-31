
import { requireEnv } from "./utils/env";

const RELAY_SERVER_URL = requireEnv("RELAY_SERVER_URL");
const PUBLIC_RELAY_SERVER_URL = requireEnv("PUBLIC_RELAY_SERVER_URL");
const MATCHMAKER_URL = requireEnv("MATCHMAKER_URL");
const PUBLIC_MATCHMAKER_URL = requireEnv("PUBLIC_MATCHMAKER_URL");
const GAME_COORDINATOR_URL = requireEnv("GAME_COORDINATOR_URL");
const PUBLIC_GAME_COORDINATOR_URL = requireEnv("PUBLIC_GAME_COORDINATOR_URL");

async function setupServers(){
  const { token: jwt } = await loginIntoRelayRoom({
    username: requireEnv("INITIAL_ADMIN_USERNAME"),
    password: requireEnv("INITIAL_ADMIN_PASSWORD"),
  });

  const { publicKey } = await getMatchMakerPublicKey();
  await addMatchMakerToRelay(jwt, { name: "Simple Battle Matchmaking", publicKey });
 
  await addGameCoordinatorToRelay(jwt, {
    id: requireEnv("GAME_COORDINATOR_ID"),
    name: "Simple WebRTC Connector",
    success_webhook_url: `${GAME_COORDINATOR_URL}/webhook/room-complete`,
    failure_webhook_url: `${GAME_COORDINATOR_URL}/webhook/room-failure`,
    api_key: requireEnv("COORDINATOR_API_KEY"),
  })
  
  await runGame();
}

async function loginIntoRelayRoom(body: { username: string, password: string }){
  const response = await fetch(`${PUBLIC_RELAY_SERVER_URL}/api/v1/admin/login`, {
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

async function getMatchMakerPublicKey(){
  const response = await fetch(`${PUBLIC_MATCHMAKER_URL}/public-key`);
  const json = await response.json();
  if(!response.ok) throw new ErrorWithDetails("Failed to get public key", json);
  return json as { publicKey: string };
}

async function addMatchMakerToRelay(jwt: string, body: { name: string, publicKey: string }){
  const response = await fetch(`${PUBLIC_RELAY_SERVER_URL}/api/v1/matchmaker`, {
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

async function addGameCoordinatorToRelay(jwt: string,
  body: {
    id: string, name: string,
    success_webhook_url: string, failure_webhook_url: string,
    api_key: string
  }
){
  const response = await fetch(`${PUBLIC_RELAY_SERVER_URL}/api/v1/game-coordinator`, {
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