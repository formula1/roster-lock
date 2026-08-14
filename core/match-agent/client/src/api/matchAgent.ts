// Thin wrappers around match-agent's own /v1/game-runner/* control routes
// (see core/match-agent/src/handle-room/version-1/game-runner.ts). These are
// specific to this app (configuring/launching a local game runner) rather
// than something a game itself needs, so they live here instead of
// @roster-lock/ts-client - see that package's README/index.ts for the
// asset-loading surface games actually consume.

export type GameRunnerLocalSettings = {
  binaryLocation?: string,
  localConfig?: unknown,
};

export type AvailableGameRunner = {
  pluginName: string,
  version: string,
  publicInfo: { title: string, description: string },
  supportedConnectionModes: Array<string>,
  supportedRoomVersions?: Array<string>,
  engineSha: string,
  gameConfigSchema: unknown,
  localConfigSchema: unknown,
};

async function matchAgentFetch(
  matchAgentUrl: string, authCode: string, path: string, init: RequestInit = {}
): Promise<Response> {
  const url = new URL(path, matchAgentUrl);
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${authCode}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Match agent request to ${path} failed (${res.status})`);
  }
  return res;
}

export async function listAvailableGameRunners(
  matchAgentUrl: string, authCode: string
): Promise<Array<AvailableGameRunner>> {
  const res = await matchAgentFetch(matchAgentUrl, authCode, "/v1/game-runner/available");
  return res.json();
}

export async function installGameRunnerPlugin(
  matchAgentUrl: string, authCode: string, pluginName: string
): Promise<void> {
  await matchAgentFetch(matchAgentUrl, authCode, `/v1/game-runner/${encodeURIComponent(pluginName)}/install`, {
    method: "POST",
  });
}

export async function getGameRunnerSettings(
  matchAgentUrl: string, authCode: string, pluginName: string
): Promise<GameRunnerLocalSettings> {
  const res = await matchAgentFetch(
    matchAgentUrl, authCode, `/v1/game-runner/${encodeURIComponent(pluginName)}/settings`
  );
  return res.json();
}

export async function setGameRunnerSettings(
  matchAgentUrl: string, authCode: string, pluginName: string, settings: GameRunnerLocalSettings
): Promise<void> {
  await matchAgentFetch(matchAgentUrl, authCode, `/v1/game-runner/${encodeURIComponent(pluginName)}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
}

export async function getGameRunnerVersion(
  matchAgentUrl: string, authCode: string, pluginName: string
): Promise<{ local: { title: string, id: string }, supported: { title: string, id: string } }> {
  const res = await matchAgentFetch(
    matchAgentUrl, authCode, `/v1/game-runner/${encodeURIComponent(pluginName)}/version`
  );
  return res.json();
}

export async function updateGameRunnerBinary(
  matchAgentUrl: string, authCode: string, pluginName: string
): Promise<void> {
  await matchAgentFetch(matchAgentUrl, authCode, `/v1/game-runner/${encodeURIComponent(pluginName)}/update`, {
    method: "POST",
  });
}

export async function startGameRunner(
  matchAgentUrl: string, authCode: string, pluginName: string, body: unknown
): Promise<{ handleId: string }> {
  const res = await matchAgentFetch(matchAgentUrl, authCode, `/v1/game-runner/${encodeURIComponent(pluginName)}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function getGameProcessStatus(
  matchAgentUrl: string, authCode: string, pluginName: string, handleId: string
): Promise<{ exited: false | { code: number } }> {
  const res = await matchAgentFetch(
    matchAgentUrl, authCode,
    `/v1/game-runner/${encodeURIComponent(pluginName)}/process/${encodeURIComponent(handleId)}`
  );
  return res.json();
}
