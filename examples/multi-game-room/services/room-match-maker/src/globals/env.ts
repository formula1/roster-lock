
function getEnv(name: string): string {
  const value = process.env[name];
  if(!value) throw new Error(`${name} is not defined`);
  return value;
}

export const PORT = getEnv("PORT");
export const PUBLIC_RELAY_SERVER_URL = getEnv("PUBLIC_RELAY_SERVER_URL");
export const RELAY_SERVER_URL = getEnv("RELAY_SERVER_URL");
// The Relay Room service still needs an admin-registered Game Coordinator on
// every create-room call (see core/relay-server's room.ts) - this example
// doesn't stand up its own coordinator, it just points at one that's already
// registered there, same as examples/full-local/services/matchmaking does.
export const GAME_COORDINATOR_ID = getEnv("GAME_COORDINATOR_ID");
// Bearer token gating the /admin/games routes. Deliberately simple - per the
// design discussion, admins are a trusted party here (they're the ones who
// derived gameConfigSchema locally in the first place), so this is about
// keeping randoms off the endpoint, not defending against a malicious admin.
export const ADMIN_API_KEY = getEnv("ADMIN_API_KEY");
