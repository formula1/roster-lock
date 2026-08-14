// Thin wrappers around match-agent's own /v1/game-runner/* control routes
// (see core/match-agent/src/handle-room/version-1/game-runner.ts). Kept
// local rather than added to @roster-lock/ts-client - per plan, ordinary
// games are expected to do their own matchmaking/game-running internally
// and never see these routes; this integration script is itself acting as
// a (headless) match-agent client, mirroring
// core/match-agent/client/src/api/matchAgent.ts's browser equivalent.

export type GameRunnerLocalSettings = {
  binaryLocation?: string,
  localConfig?: unknown,
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

export async function installGameRunnerPlugin(
  matchAgentUrl: string, authCode: string, pluginName: string
): Promise<void> {
  await matchAgentFetch(matchAgentUrl, authCode, `/v1/game-runner/${encodeURIComponent(pluginName)}/install`, {
    method: "POST",
  });
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
