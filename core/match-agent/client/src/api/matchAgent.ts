// Thin wrappers around match-agent's own /v1/game-launcher/* control routes
// (see core/match-agent/src/handle-room/version-1/game-launcher/). These are
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
// concrete binary - see resolveTarget in game-launcher/shared.ts. Omitting `target`
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

// Opens a native OS folder-picker on match-agent's own host (see
// core/match-agent/src/utils/pick-folder.ts for why a browser <input> can't
// do this itself) and returns the chosen absolute path. `cancelled: true`
// means the user closed the dialog without picking anything; the picker
// itself may not exist on a headless/remote match-agent, in which case this
// throws and the caller should fall back to manual text entry.
export async function pickGameLauncherBinaryLocation(
  matchAgentUrl: string, authCode: string, pluginName: string
): Promise<{ path: string } | { cancelled: true }> {
  const res = await matchAgentFetch(
    matchAgentUrl, authCode, `/v1/game-launcher/${encodeURIComponent(pluginName)}/pick-binary-location`,
    { method: "POST" }
  );
  return res.json();
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

// WS counterpart to listGameProcesses (see game-launcher/process.ts's gameProcessesWs)
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

export type NavAction = "select" | "back" | "menu";
export type KeyboardBindings = Record<NavAction, string>;
export type GamepadBindings = Record<NavAction, number>;
export type InputBindings = { keyboard: KeyboardBindings, gamepad: GamepadBindings };

// Stored by match-agent next to its own portable config file (see
// core/match-agent/src/config/inputBindings.ts), not in this browser's
// localStorage - an arcade/internet-cafe host's browser profile doesn't
// travel with the player, but match-agent run off their own USB does (see
// docs/economics/machine-environments/pieces-usb.md/cafe.md).
export async function getInputBindings(matchAgentUrl: string, authCode: string): Promise<InputBindings> {
  const res = await matchAgentFetch(matchAgentUrl, authCode, "/v1/input-bindings");
  return res.json();
}

export async function setInputBindings(
  matchAgentUrl: string, authCode: string, bindings: InputBindings
): Promise<void> {
  await matchAgentFetch(matchAgentUrl, authCode, "/v1/input-bindings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bindings),
  });
}

// Opens a native OS file-picker on match-agent's own host (see
// core/match-agent/src/utils/pick-file.ts for why a browser <input> can't
// hand back an absolute path) pre-seeded with whatever path is already
// typed, if any. `cancelled: true` means the user closed the dialog
// without picking anything; the picker itself may not exist on a
// headless/remote match-agent, in which case this throws and the caller
// should fall back to typing the path manually (which, via the on-screen
// keyboard, is also the only option a gamepad-only player has anyway).
// Mounted outside /v1 (see src/index.ts's startServer) - these don't touch
// the room protocol, and are bounded to match-agent's configured
// rosterLockFolder (core/match-agent/src/util-routers/file-system/
// resolve-within-root.ts), not anywhere else its host filesystem happens
// to reach: a plain "list any path, read any file" HTTP API would hand
// anyone holding the auth code a way to enumerate/read the whole machine
// programmatically, which the native OS dialog this feature replaces
// never could (it only ever returns one path, chosen through a trusted
// OS UI - never a general filesystem-browsing capability).
export async function pickRosterLockFile(
  matchAgentUrl: string, authCode: string, startPath?: string
): Promise<{ path: string } | { cancelled: true }> {
  const res = await matchAgentFetch(matchAgentUrl, authCode, "/util/file-system/roster-lock/pick", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ startPath }),
  });
  return res.json();
}

// Reads+parses a roster-lock config straight off match-agent's own host
// disk - lets pages/PreviewRoster open a SelectionBoard against a roster
// lock directly, with no matchmaker/room (and so none of the Docker
// services/real login flow those need) involved at all.
export async function readRosterLock(
  matchAgentUrl: string, authCode: string, path: string
): Promise<RosterLockV1Config> {
  const res = await matchAgentFetch(
    matchAgentUrl, authCode, `/util/file-system/roster-lock?path=${encodeURIComponent(path)}`
  );
  return res.json();
}

export type DirectoryEntry = { name: string, path: string, isDirectory: boolean };
export type DirectoryListing = { path: string, parent: string | null, entries: Array<DirectoryEntry> };

// Backs OnScreenFileDialog - a file picker rendered in the page itself
// rather than a native OS dialog, so it's reachable through the same
// Move/Select/Back scheme (GlobalNavContext) a gamepad already uses
// everywhere else. `path` omitted defaults to match-agent's configured
// rosterLockFolder; `extension` (e.g. ".roster-lock.json") filters which
// files show up without hiding any folders, so navigation is never blocked.
export async function listDirectory(
  matchAgentUrl: string, authCode: string, path?: string, extension?: string
): Promise<DirectoryListing> {
  const params = new URLSearchParams();
  if (path) params.set("path", path);
  if (extension) params.set("extension", extension);
  const query = params.toString();
  const res = await matchAgentFetch(matchAgentUrl, authCode, `/util/file-system/list${query ? `?${query}` : ""}`);
  return res.json();
}
