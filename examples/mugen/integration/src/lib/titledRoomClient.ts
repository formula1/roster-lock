// Thin wrapper around examples/services/match-makers/titled-room's player
// HTTP/WS surface - mirrors
// examples/services/match-makers/titled-room/client/src/api/titledRoom.ts,
// which is the browser equivalent (this script plays both host and client
// itself, so it talks to titled-room directly rather than through that
// React app).

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
  participants: Record<string, { userId: string, identifier: string, ready: boolean, publicKey?: string }>,
};

export type StartRoomResult = {
  success: true,
  relayUrl: string,
  roomId: string,
  coordinator: { host: string, port: number } | null,
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

export async function startRoom(titledRoomUrl: string, token: string, roomId: string): Promise<StartRoomResult> {
  const res = await roomFetch(titledRoomUrl, token, "/room/start", { method: "POST", body: JSON.stringify({ roomId }) });
  return res.json();
}

export async function getRoom(titledRoomUrl: string, token: string, roomId: string): Promise<RoomData> {
  const res = await roomFetch(titledRoomUrl, token, `/room/${encodeURIComponent(roomId)}`);
  return res.json();
}

export type RoomEvent = (
  | { type: "USER_IS_READY", payload: { userId: string, identifier: string } }
  | { type: "USER_LEFT", payload: { userId: string, identifier: string } }
  | { type: "GAME_HAS_STARTED", payload: StartRoomResult }
);

// Connects to /room/listen and resolves once GAME_HAS_STARTED arrives -
// that's the only event this script needs to react to; ready/left events
// are only useful for a UI. sendReady() is exposed separately so callers can
// connect first (to not miss a start broadcast) and send ready once their
// selection is actually done.
export function connectRoomSocket(
  titledRoomUrl: string, token: string, roomId: string
): { sendReady: () => Promise<void>, waitForGameStart: () => Promise<StartRoomResult>, close: () => void } {
  const url = new URL("/room/listen", titledRoomUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("token", token);
  url.searchParams.set("roomId", roomId);

  const ws = new WebSocket(url.href);
  let resolveStart: ((result: StartRoomResult) => void) | undefined;
  let rejectStart: ((err: Error) => void) | undefined;
  const startPromise = new Promise<StartRoomResult>((resolve, reject) => {
    resolveStart = resolve;
    rejectStart = reject;
  });
  // A caller that sends ready and never calls waitForGameStart() (this
  // orchestrator's own player.ts - it learns relayUrl/coordinator straight
  // from the host's own /room/start response instead) still leaves this
  // promise reachable via the closure below; without this it becomes an
  // unhandled rejection whenever the socket errors later (e.g. during
  // teardown), even though nothing was ever waiting on it. Doesn't swallow
  // the rejection for real callers - a promise can have more than one
  // .catch()/.then() attached.
  startPromise.catch(() => {});
  const openPromise = new Promise<void>((resolve, reject) => {
    ws.addEventListener("open", () => resolve());
    ws.addEventListener("error", () => reject(new Error(`WebSocket error connecting to ${url.href}`)));
  });
  openPromise.catch(() => {});

  ws.addEventListener("message", (event) => {
    try {
      const parsed = JSON.parse(event.data as string) as RoomEvent;
      if (parsed.type === "GAME_HAS_STARTED") resolveStart?.(parsed.payload);
    } catch {
      // Ignore malformed frames rather than tearing down the connection.
    }
  });
  ws.addEventListener("error", () => rejectStart?.(new Error(`WebSocket error connecting to ${url.href}`)));

  return {
    sendReady: async () => {
      await openPromise;
      ws.send(JSON.stringify({ type: "I_AM_READY" }));
    },
    waitForGameStart: () => startPromise,
    close: () => ws.close(),
  };
}
