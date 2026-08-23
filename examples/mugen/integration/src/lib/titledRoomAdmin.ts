// Admin surface for examples/services/match-makers/titled-room - separate
// from the regular-user auth in lib/authClient.ts, mirroring
// core/relay-server's own admin login (see lib/relayAdmin.ts). Replaces
// what used to be static ALLOWED_GAME_RUNNERS/GAME_COORDINATORS env vars -
// see titled-room's src/admin/game-launchers.ts.

export async function adminLogin(titledRoomUrl: string, username: string, password: string): Promise<string> {
  const res = await fetch(new URL("/admin/login", titledRoomUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `titled-room admin login failed (${res.status})`);
  return (json as { token: string }).token;
}

export type GameLauncherCoordinator = false | { id: string, address: { host: string, port: number } };

// Idempotent - PUT upserts, so re-running the integration script against an
// already-configured titled-room (its D1 data persists across a plain
// stop/start, same as relay-room's) just overwrites with the same values.
export async function upsertGameLauncher(
  titledRoomUrl: string, adminToken: string, pluginName: string,
  body: { engineSha: string, coordinator: GameLauncherCoordinator },
): Promise<void> {
  const res = await fetch(new URL(`/admin/game-launchers/${encodeURIComponent(pluginName)}`, titledRoomUrl), {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || `Failed to register game launcher "${pluginName}" (${res.status})`);
  }
}
