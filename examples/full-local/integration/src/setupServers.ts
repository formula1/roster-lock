export type ServerSetupConfig = {
  publicRelayServerUrl: string,
  publicMatchmakerUrl: string,
  gameCoordinatorUrl: string,
  initialAdminUsername: string,
  initialAdminPassword: string,
  gameCoordinatorId: string,
  coordinatorApiKey: string,
};

export async function setupServers(config: ServerSetupConfig){
  const { token: jwt } = await loginIntoRelayRoom(config, {
    username: config.initialAdminUsername,
    password: config.initialAdminPassword,
  });

  const { publicKey } = await getMatchMakerPublicKey(config);
  await addMatchMakerToRelay(config, jwt, { name: "Simple Battle Matchmaking", publicKey });

  await addGameCoordinatorToRelay(config, jwt, {
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
