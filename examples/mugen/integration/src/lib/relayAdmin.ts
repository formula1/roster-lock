// Registers this deployment's matchmaker (titled-room) and game coordinator
// (direct-ip-coordinator) with relay-room's admin API - mirrors
// examples/full-local/integration/src/setupServers.ts's equivalent
// functions exactly, just against mugen's own services.

export class ErrorWithDetails extends Error {
  constructor(message: string, public details: any){ super(message); }
}

export async function loginIntoRelayRoom(
  publicRelayServerUrl: string, body: { username: string, password: string }
): Promise<{ token: string, passwordExpired: boolean }> {
  const response = await fetch(`${publicRelayServerUrl}/api/v1/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if(!response.ok) throw new ErrorWithDetails("Failed to log into relay-room admin", json);
  return json as { token: string, passwordExpired: boolean };
}

// matchmakers.name is UNIQUE in the relay's schema, and this always
// registers under the same fixed name - so re-running against a relay-room
// that wasn't cleanly torn down (its SQLite data persists across a plain
// stop/start) would otherwise hit a constraint violation. Reuse the
// existing registration instead of re-inserting.
export async function ensureMatchMakerRegistered(
  publicRelayServerUrl: string, jwt: string, body: { name: string, publicKey: string }
){
  const existing = (await listMatchMakers(publicRelayServerUrl, jwt)).find(m => m.name === body.name);
  if(existing){
    if(existing.public_key !== body.publicKey){
      throw new ErrorWithDetails(
        `Matchmaker "${body.name}" is already registered with a different public key - ` +
        `if titled-room's keys were regenerated, run "docker compose down" first to clear the relay's old registration`,
        { existingId: existing.id }
      );
    }
    return existing;
  }
  return addMatchMakerToRelay(publicRelayServerUrl, jwt, body);
}

async function listMatchMakers(publicRelayServerUrl: string, jwt: string){
  const response = await fetch(`${publicRelayServerUrl}/api/v1/matchmaker`, {
    headers: { "Authorization": `Bearer ${jwt}` },
  });
  const json = await response.json();
  if(!response.ok) throw new ErrorWithDetails("Failed to list matchmakers", json);
  return json as Array<{ id: string, name: string, public_key: string }>;
}

async function addMatchMakerToRelay(publicRelayServerUrl: string, jwt: string, body: { name: string, publicKey: string }){
  const response = await fetch(`${publicRelayServerUrl}/api/v1/matchmaker`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${jwt}` },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if(!response.ok) throw new ErrorWithDetails("Failed to add matchmaker to relay", json);
  return json as { id: string, name: string, publicKey: string };
}

// game_coordinators.id is the PRIMARY KEY and .name is also UNIQUE, and this
// always registers under the same fixed id/name - same story as
// ensureMatchMakerRegistered above.
export async function ensureGameCoordinatorRegistered(
  publicRelayServerUrl: string, jwt: string,
  body: { id: string, name: string, success_webhook_url: string, failure_webhook_url: string, api_key: string }
){
  const existing = await getGameCoordinator(publicRelayServerUrl, jwt, body.id);
  if(existing) return existing;
  return addGameCoordinatorToRelay(publicRelayServerUrl, jwt, body);
}

async function getGameCoordinator(publicRelayServerUrl: string, jwt: string, id: string){
  const response = await fetch(`${publicRelayServerUrl}/api/v1/game-coordinator/${id}`, {
    headers: { "Authorization": `Bearer ${jwt}` },
  });
  if(response.status === 404) return null;
  const json = await response.json();
  if(!response.ok) throw new ErrorWithDetails("Failed to look up game coordinator", json);
  return json as { id: string, name: string };
}

async function addGameCoordinatorToRelay(
  publicRelayServerUrl: string, jwt: string,
  body: { id: string, name: string, success_webhook_url: string, failure_webhook_url: string, api_key: string }
){
  const response = await fetch(`${publicRelayServerUrl}/api/v1/game-coordinator`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${jwt}` },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if(!response.ok) throw new ErrorWithDetails("Failed to add game coordinator to relay", json);
  return json as { id: string, name: string };
}
