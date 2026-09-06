// Thin wrappers around match-agent's own /v1/game-launcher/* control routes
// (see core/match-agent/src/handle-room/version-1/game-launcher.ts). These are
// specific to this app (configuring/launching a local game launcher) rather
// than something a game itself needs, so they live here instead of
// @roster-lock/ts-client - see that package's README/index.ts for the
// asset-loading surface games actually consume.

import { PlatformTarget, PiecePreview, RosterLockV1Config, RosterLockPiece } from "@roster-lock/types";
import { MessageBridge } from "@roster-lock/utils";

export type GameLauncherLocalSettings = {
  binaryLocation?: string,
  localConfig?: unknown,
};

export type AvailableGameLauncher = {
  pluginName: string,
  version: string,
  publicInfo: { title: string, description: string },
  supportedConnectionModes: Array<string>,
  supportedRoomVersions?: Array<string>,
  supportedPlatforms: Array<PlatformTarget>,
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

// Appended as query params on any game-launcher route that resolves a
// concrete binary - see resolveTarget in game-launcher.ts. Omitting `target`
// entirely (the ordinary case) leaves match-agent to default to its own
// current host; passing one is only for the deliberate exception (see
// docs/v2/binary-location.md).
function withTarget(path: string, target?: PlatformTarget): string {
  if(!target) return path;
  const params = new URLSearchParams({ platform: target.platform, arch: target.arch });
  return `${path}?${params.toString()}`;
}

export async function listAvailableGameLaunchers(
  matchAgentUrl: string, authCode: string
): Promise<Array<AvailableGameLauncher>> {
  const res = await matchAgentFetch(matchAgentUrl, authCode, "/v1/game-launcher/available");
  return res.json();
}

export async function installGameLauncherPlugin(
  matchAgentUrl: string, authCode: string, pluginName: string
): Promise<void> {
  await matchAgentFetch(matchAgentUrl, authCode, `/v1/game-launcher/${encodeURIComponent(pluginName)}/install`, {
    method: "POST",
  });
}

export async function getGameLauncherSettings(
  matchAgentUrl: string, authCode: string, pluginName: string
): Promise<GameLauncherLocalSettings> {
  const res = await matchAgentFetch(
    matchAgentUrl, authCode, `/v1/game-launcher/${encodeURIComponent(pluginName)}/settings`
  );
  return res.json();
}

export async function setGameLauncherSettings(
  matchAgentUrl: string, authCode: string, pluginName: string, settings: GameLauncherLocalSettings
): Promise<void> {
  await matchAgentFetch(matchAgentUrl, authCode, `/v1/game-launcher/${encodeURIComponent(pluginName)}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
}

export async function getGameLauncherVersion(
  matchAgentUrl: string, authCode: string, pluginName: string, target?: PlatformTarget
): Promise<{ local: { title: string, id: string }, supported: { title: string, id: string } }> {
  const res = await matchAgentFetch(
    matchAgentUrl, authCode, withTarget(`/v1/game-launcher/${encodeURIComponent(pluginName)}/version`, target)
  );
  return res.json();
}

export async function validateGameLauncherBinaryLocation(
  matchAgentUrl: string, authCode: string, pluginName: string, target?: PlatformTarget
): Promise<{ valid: true } | { valid: false, message: string }> {
  const res = await matchAgentFetch(
    matchAgentUrl, authCode, withTarget(`/v1/game-launcher/${encodeURIComponent(pluginName)}/validate`, target)
  );
  return res.json();
}

export async function validateGameLauncherGameConfig(
  matchAgentUrl: string, authCode: string, pluginName: string, gameConfig: unknown, rosterConfig: unknown
): Promise<Array<string>> {
  const res = await matchAgentFetch(
    matchAgentUrl, authCode, `/v1/game-launcher/${encodeURIComponent(pluginName)}/validate-game-config`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameConfig, rosterConfig }),
    }
  );
  const { problems } = await res.json();
  return problems;
}

export async function getGameLauncherPreview(
  matchAgentUrl: string, authCode: string, pluginName: string,
  engine: RosterLockV1Config["engine"], pieceType: string, piece: Pick<RosterLockPiece, "version" | "pathVariables">
): Promise<PiecePreview | null> {
  const res = await matchAgentFetch(
    matchAgentUrl, authCode, `/v1/game-launcher/${encodeURIComponent(pluginName)}/preview`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ engine, pieceType, piece }),
    }
  );
  const { preview } = await res.json();
  return preview;
}

export async function updateGameLauncherBinary(
  matchAgentUrl: string, authCode: string, pluginName: string, target?: PlatformTarget
): Promise<void> {
  await matchAgentFetch(
    matchAgentUrl, authCode, withTarget(`/v1/game-launcher/${encodeURIComponent(pluginName)}/update`, target),
    { method: "POST" }
  );
}

export async function startGameLauncher(
  matchAgentUrl: string, authCode: string, pluginName: string, body: unknown, target?: PlatformTarget
): Promise<{ handleId: string }> {
  const res = await matchAgentFetch(
    matchAgentUrl, authCode, withTarget(`/v1/game-launcher/${encodeURIComponent(pluginName)}/start`, target),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  return res.json();
}

export async function getGameProcessStatus(
  matchAgentUrl: string, authCode: string, pluginName: string, handleId: string
): Promise<{ exited: false | { code: number } }> {
  const res = await matchAgentFetch(
    matchAgentUrl, authCode,
    `/v1/game-launcher/${encodeURIComponent(pluginName)}/process/${encodeURIComponent(handleId)}`
  );
  return res.json();
}

export type GameProcessSummary = {
  handleId: string,
  pluginName: string,
  exited: false | { code: number },
};

export async function listGameProcesses(
  matchAgentUrl: string, authCode: string
): Promise<Array<GameProcessSummary>> {
  const res = await matchAgentFetch(matchAgentUrl, authCode, "/v1/game-launcher/processes");
  return res.json();
}

// WS counterpart to listGameProcesses (see game-launcher.ts's gameProcessesWs)
// - pushes the current snapshot immediately and again on every later
// start/exit, so a caller like pages/Game doesn't have to poll. Returns an
// unsubscribe function that closes the socket.
export function subscribeToGameProcesses(
  matchAgentUrl: string, authCode: string,
  onUpdate: (processes: Array<GameProcessSummary>) => void, onError: (error: Error) => void
): () => void {
  const wsUrl = new URL("/v1/game-launcher/processes", matchAgentUrl);
  wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
  wsUrl.searchParams.set("authorization", authCode);

  const ws = new WebSocket(wsUrl.href);
  const bridge = new MessageBridge((message) => ws.send(JSON.stringify(message)));
  ws.addEventListener("message", (event) => bridge.handleMessage(JSON.parse(event.data)));
  ws.addEventListener("error", () => onError(new Error("Lost connection to match agent")));
  bridge.onEvent("processes", (processes) => onUpdate(processes));

  return () => ws.close();
}

export async function stopGameLauncher(
  matchAgentUrl: string, authCode: string, pluginName: string, handleId: string
): Promise<void> {
  await matchAgentFetch(
    matchAgentUrl, authCode,
    `/v1/game-launcher/${encodeURIComponent(pluginName)}/process/${encodeURIComponent(handleId)}/stop`,
    { method: "POST" }
  );
}
