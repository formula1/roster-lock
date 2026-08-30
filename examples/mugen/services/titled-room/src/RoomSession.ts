import type { DurableObject, DurableObjectState, WebSocket } from "@cloudflare/workers-types";
import { createShaFromJSON } from "@roster-lock/utils";
import { RoomMachine } from "@roster-lock/types";
import { Env, RoomData, RoomParticipant, PublicUserProfile } from "./types";
import { createRelayRoom } from "./relay-client";
import { gameCoordinatorFor, GameCoordinatorConfig } from "./game-launchers";

type JoinRequest = PublicUserProfile & { machineId: string };

export class RoomSession implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private roomData?: RoomData;
  private sessions: Map<WebSocket, { userId: string; identifier: string }> = new Map();

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/init" && request.method === "POST") {
      const body = await request.json<any>();
      const { hostUser, machineId, title, gameLauncherPlugin, rosterConfig, gameConfig, maxPlayers, minPlayers } = body;

      const hostParticipant: RoomParticipant = {
        userId: hostUser.id,
        identifier: hostUser.identifier,
        machineId,
        displayName: hostUser.displayName,
        playerCount: hostUser.playerCount,
        publicKey: hostUser.publicKey,
        ready: false,
        joinedAt: new Date().toISOString(),
      };

      this.roomData = {
        id: url.searchParams.get("roomId")!,
        title,
        hostUserId: hostUser.id,
        gameLauncherPlugin,
        rosterConfig,
        gameConfig,
        maxPlayers: maxPlayers || 2,
        minPlayers: minPlayers || 2,
        status: "waiting",
        createdAt: new Date().toISOString(),
        participants: { [hostUser.id]: hostParticipant },
      };

      await this.state.storage.put("roomData", this.roomData);
      return new Response(JSON.stringify(this.roomData), { headers: { "Content-Type": "application/json" } });
    }

    if (!this.roomData) {
      this.roomData = await this.state.storage.get<RoomData>("roomData");
    }

    if (!this.roomData) {
      return new Response("Room not initialized", { status: 404 });
    }

    if (url.pathname === "/state" && request.method === "GET") {
      return new Response(JSON.stringify(this.roomData), { headers: { "Content-Type": "application/json" } });
    }

    if (url.pathname === "/join" && request.method === "POST") {
      const user = await request.json<JoinRequest>();
      if (this.roomData.status !== "waiting") {
        return new Response(JSON.stringify({ error: "Room not accepting players" }), { status: 400 });
      }
      if (this.roomData.participants[user.id]) {
        return new Response(JSON.stringify({ error: "User already joined this room" }), { status: 400 });
      }

      let currentTotalPlayers = 0;
      Object.values(this.roomData.participants).forEach((p) => (currentTotalPlayers += p.playerCount));

      if (currentTotalPlayers + user.playerCount > this.roomData.maxPlayers) {
        return new Response(JSON.stringify({ error: "Room maximum player capacity reached" }), { status: 400 });
      }

      this.roomData.participants[user.id] = {
        userId: user.id,
        identifier: user.identifier,
        machineId: user.machineId,
        displayName: user.displayName,
        playerCount: user.playerCount,
        publicKey: user.publicKey,
        ready: false,
        joinedAt: new Date().toISOString(),
      };

      await this.state.storage.put("roomData", this.roomData);
      return new Response(JSON.stringify(this.roomData), { headers: { "Content-Type": "application/json" } });
    }

    if (url.pathname === "/destroy" && request.method === "POST") {
      const { requestingUserId } = await request.json<any>();
      if (this.roomData.hostUserId !== requestingUserId) {
        return new Response(JSON.stringify({ error: "Only room host can destroy room" }), { status: 403 });
      }
      this.roomData.status = "destroyed";
      // Broadcast before deleting - once storage is gone, this instance has
      // nothing left to tell reconnecting/late sessions (see /state above,
      // which 404s once roomData is undefined). Any participant not
      // currently connected only finds out by hitting that 404 on refresh.
      this.broadcast({ type: "ROOM_DESTROYED", payload: {} });
      await this.state.storage.delete("roomData");
      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    }

    if (url.pathname === "/start" && request.method === "POST") {
      const { requestingUserId } = await request.json<any>();
      if (this.roomData.hostUserId !== requestingUserId) {
        return new Response(JSON.stringify({ error: "Only host can start room" }), { status: 403 });
      }

      let totalPlayers = 0;
      for (const p of Object.values(this.roomData.participants)) {
        if (!p.ready) {
          return new Response(JSON.stringify({ error: "Not all players are ready" }), { status: 400 });
        }
        if (!p.publicKey) {
          return new Response(
            JSON.stringify({ error: `Participant ${p.identifier} has no publicKey set (see /auth/set-public-key)` }),
            { status: 400 }
          );
        }
        totalPlayers += p.playerCount;
      }

      if (totalPlayers < this.roomData.minPlayers) {
        return new Response(JSON.stringify({ error: `Minimum required players (${this.roomData.minPlayers}) not met` }), { status: 400 });
      }

      // Throws if the plugin is allowlisted but has no GAME_COORDINATORS
      // entry at all - that's a deployment misconfiguration, not a legitimate
      // "no coordinator" choice. `false` (a real, explicit choice) passes
      // straight through to createRelayRoom below.
      let coordinator: GameCoordinatorConfig | false;
      try {
        coordinator = await gameCoordinatorFor(this.env, this.roomData.gameLauncherPlugin);
      } catch (e) {
        return new Response(JSON.stringify({ error: (e as Error).message }), { status: 400 });
      }

      const machines: Array<RoomMachine> = Object.values(this.roomData.participants).map((p) => ({
        machineId: p.machineId,
        publicKey: p.publicKey!,
        displayName: p.displayName || p.identifier,
        playerCount: p.playerCount,
      }));

      let relay: { roomId: string };
      try {
        relay = await createRelayRoom(this.env, {
          rosterConfig: this.roomData.rosterConfig,
          rosterConfigHash: await createShaFromJSON(this.roomData.rosterConfig),
          machines,
          coordinatorId: coordinator ? coordinator.id : false,
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: (e as Error).message }), { status: 502 });
      }

      this.roomData.status = "started";
      await this.state.storage.put("roomData", this.roomData);

      // Clients learn the game-coordinator's address the same way they learn
      // relayUrl - here, not through a separately configured env var per
      // client (see docs/v2/ikemen-go/game-coordinator.md).
      const startPayload = {
        relayUrl: this.env.PUBLIC_RELAY_SERVER_URL || this.env.RELAY_SERVER_URL!,
        roomId: relay.roomId,
        coordinator: coordinator ? coordinator.address : null,
      };
      this.broadcast({ type: "GAME_HAS_STARTED", payload: startPayload });
      return new Response(JSON.stringify({ success: true, ...startPayload }), { headers: { "Content-Type": "application/json" } });
    }

    if (request.headers.get("Upgrade") === "websocket") {
      const userId = url.searchParams.get("userId");
      const identifier = url.searchParams.get("identifier");
      if (!userId || !identifier) return new Response("Missing parameters", { status: 400 });

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      this.state.acceptWebSocket(server);
      this.sessions.set(server, { userId, identifier });

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Not found", { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") return;
    const session = this.sessions.get(ws);
    if (!session || !this.roomData) return;

    try {
      const data = JSON.parse(message);
      if (data.type === "I_AM_READY") {
        if (this.roomData.participants[session.userId]) {
          this.roomData.participants[session.userId].ready = true;
          await this.state.storage.put("roomData", this.roomData);

          this.broadcast({
            type: "USER_IS_READY",
            payload: { userId: session.userId, identifier: session.identifier },
          });
        }
      }
    } catch (err) {
      console.error("Durable Object WS Error:", err);
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const session = this.sessions.get(ws);
    this.sessions.delete(ws);
    if (session) {
      this.broadcast({ type: "USER_LEFT", payload: { userId: session.userId, identifier: session.identifier } });
    }
  }

  private broadcast(msg: any) {
    const payload = JSON.stringify(msg);
    this.sessions.forEach((_, ws) => {
      ws.send(payload);
    });
  }
}
