// Wrapper around examples/mugen/services/titled-room's HTTP/WS surface.

export type RoomParticipant = {
  userId: string,
  identifier: string,
  machineId: string,
  displayName?: string,
  playerCount: number,
  publicKey?: string,
  ready: boolean,
  joinedAt: string,
};

export type RoomData = {
  id: string,
  title: string,
  hostUserId: string,
  gameLauncherPlugin: string,
  rosterConfig: any,
  gameConfig: any,
  maxPlayers: number,
  minPlayers: number,
  status: "waiting" | "starting" | "started" | "destroyed",
  createdAt: string,
  participants: Record<string, RoomParticipant>,
};

export type RoomIndexEntry = {
  id: string,
  title: string,
  hostUserId: string,
  gameLauncherPlugin: string,
  rosterConfigHash: string,
  status: string,
  maxPlayers: number,
  minPlayers: number,
  participantCount: number,
  createdAt: string,
};

async function roomFetch(titledRoomUrl: string, token: string, path: string, init: RequestInit = {}): Promise<Response> {
  const url = new URL(path, titledRoomUrl);
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Room request to ${path} failed (${res.status})`);
  }
  return res;
}

export async function createRoom(titledRoomUrl: string, token: string, body: {
  title: string, gameLauncherPlugin: string, rosterConfig: unknown, gameConfig: unknown,
  maxPlayers?: number, minPlayers?: number, machineId: string,
}): Promise<RoomData> {
  const res = await roomFetch(titledRoomUrl, token, "/room/create", { method: "POST", body: JSON.stringify(body) });
  return res.json();
}

export async function joinRoom(titledRoomUrl: string, token: string, roomId: string, machineId: string): Promise<RoomData> {
  const res = await roomFetch(titledRoomUrl, token, "/room/join", {
    method: "POST", body: JSON.stringify({ roomId, machineId }),
  });
  return res.json();
}

export async function leaveRoom(titledRoomUrl: string, token: string, roomId: string): Promise<RoomData> {
  const res = await roomFetch(titledRoomUrl, token, "/room/leave", {
    method: "POST", body: JSON.stringify({ roomId }),
  });
  return res.json();
}

export async function startRoom(
  titledRoomUrl: string, token: string, roomId: string
): Promise<{ success: true, relayUrl: string, roomId: string, coordinator: { host: string, port: number } | null }> {
  const res = await roomFetch(titledRoomUrl, token, "/room/start", { method: "POST", body: JSON.stringify({ roomId }) });
  return res.json();
}

export async function destroyRoom(titledRoomUrl: string, token: string, roomId: string): Promise<void> {
  await roomFetch(titledRoomUrl, token, "/room/destroy", { method: "POST", body: JSON.stringify({ roomId }) });
}

// Unauthenticated (no Authorization header, unlike roomFetch above) - GET
// /game-launchers is public, see index.ts. Just the plugin names this
// deployment allows rooms to be created for, so the client can offer to
// install whatever's missing via the host bridge before the user has to
// find a package name themselves.
export async function listAllowedGameLaunchers(titledRoomUrl: string): Promise<Array<{ pluginName: string }>> {
  const res = await fetch(new URL("/game-launchers", titledRoomUrl));
  if (!res.ok) throw new Error(`Failed to fetch allowed game launchers (${res.status})`);
  return res.json();
}

export async function listRooms(titledRoomUrl: string, token: string, title?: string): Promise<Array<RoomIndexEntry>> {
  const path = title ? `/room?title=${encodeURIComponent(title)}` : "/room";
  const res = await roomFetch(titledRoomUrl, token, path);
  return res.json();
}

export async function getRoom(titledRoomUrl: string, token: string, roomId: string): Promise<RoomData> {
  const res = await roomFetch(titledRoomUrl, token, `/room/${encodeURIComponent(roomId)}`);
  return res.json();
}

export type RoomEvent = (
  | { type: "USER_JOINED", payload: { userId: string, identifier: string } }
  | { type: "USER_IS_READY", payload: { userId: string, identifier: string } }
  | { type: "USER_LEFT", payload: { userId: string, identifier: string } }
  | { type: "GAME_IS_STARTING", payload: {} }
  | {
      type: "GAME_HAS_STARTED",
      payload: { relayUrl: string, roomId: string, coordinator: { host: string, port: number } | null },
    }
  | { type: "ROOM_DESTROYED", payload: {} }
  | { type: "ROOM_FAILED", payload: { reason: string } }
);

export type RoomSocket = {
  sendReady: () => void,
  close: () => void,
};

// The room's own WS protocol is raw {type, payload} JSON (see
// RoomSession.ts), not MessageBridge RPC framing - so this is a plain
// onmessage wrapper, not a reuse of the host/matchmaker bridge.
export function listenToRoom(
  titledRoomUrl: string, token: string, roomId: string, onEvent: (event: RoomEvent) => void
): RoomSocket {
  const url = new URL("/room/listen", titledRoomUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("token", token);
  url.searchParams.set("roomId", roomId);

  const ws = new WebSocket(url.href);
  ws.addEventListener("message", (event) => {
    try {
      onEvent(JSON.parse(event.data as string));
    } catch {
      // Ignore malformed frames rather than tearing down the connection.
    }
  });

  return {
    sendReady: () => ws.send(JSON.stringify({ type: "I_AM_READY" })),
    close: () => ws.close(),
  };
}
