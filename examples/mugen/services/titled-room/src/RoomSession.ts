import type { DurableObject, DurableObjectState, WebSocket } from "@cloudflare/workers-types";
import { createShaFromJSON } from "@roster-lock/utils";
import { RoomMachine } from "@roster-lock/types";
import { Env, RoomData, RoomParticipant, PublicUserProfile } from "./types";
import { createRelayRoom } from "./relay-client";
import { gameCoordinatorFor, GameCoordinatorConfig } from "./game-launchers";

type JoinRequest = PublicUserProfile & { machineId: string };
type WebSocketSession = { userId: string; identifier: string };

// Thrown from inside an updateRoomData()/assertCanStart() check to abort a
// transaction without writing anything - caught at the fetch() call site and
// turned into the equivalent error Response, instead of every check having
// to thread its own early-return status code through the transaction.
class RoomActionError extends Error {
  constructor(message: string, public status: number = 400) {
    super(message);
  }
}

export class RoomSession implements DurableObject {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  // this.roomData is a per-instance cache, not a source of truth - the DO
  // hibernates and comes back as a fresh instance to run webSocketMessage/
  // webSocketClose for an already-open socket, so every handler (not just
  // fetch()) must be able to reload it from storage on a cold wake rather
  // than assuming whatever ran earlier in this same instance already did.
  private async getRoomData(): Promise<RoomData | undefined> {
    return await this.state.storage.get<RoomData>("roomData");
  }

  // Every check-then-write against roomData goes through here so the two
  // halves happen against the same storage transaction - reading via
  // this.roomData (or getRoomData()) and writing separately left a window
  // for another event on this room (a second /join, a leave, a ready signal)
  // to land in between and get silently clobbered by the first write.
  // `mutate` inspects/changes `room` in place; throwing a RoomActionError
  // aborts the transaction (nothing is persisted) instead of committing.
  private async updateRoomData<T = void>(mutate: (room: RoomData) => T): Promise<{ room: RoomData, result: T }> {
    const result = await this.state.storage.transaction(async (txn) => {
      const room = await txn.get<RoomData>("roomData");
      if (!room) throw new RoomActionError("Room not initialized", 404);
      const result = mutate(room);
      await txn.put("roomData", room);
      return { room, result };
    });
    return result;
  }

  private errorResponse(e: unknown): Response {
    if (e instanceof RoomActionError) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: e.status, headers: { "Content-Type": "application/json" },
      });
    }
    console.error("RoomSession error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 });
  }

  // Shared by /start's pre-flight check (fail fast before paying for the
  // coordinator/relay-room calls) and its final commit (re-checked against
  // the freshest stored state, since those calls happen outside any
  // transaction and room membership/status could change while they're in flight).
  private assertCanStart(room: RoomData, requestingUserId: string): number {
    if (room.hostUserId !== requestingUserId) throw new RoomActionError("Only host can start room", 403);
    if (room.status !== "waiting") throw new RoomActionError("Room is no longer waiting to start");

    let totalPlayers = 0;
    for (const p of Object.values(room.participants)) {
      if (!p.ready) throw new RoomActionError("Not all players are ready");
      if (!p.publicKey) {
        throw new RoomActionError(`Participant ${p.identifier} has no publicKey set (see /auth/set-public-key)`);
      }
      totalPlayers += p.playerCount;
    }

    if (totalPlayers < room.minPlayers) {
      throw new RoomActionError(`Minimum required players (${room.minPlayers}) not met`);
    }
    return totalPlayers;
  }

  // /start can fail after the room has already been transitioned to
  // "starting" (coordinator lookup or relay-room creation failing) - rather
  // than reverting to "waiting" for a silent retry nobody but the requester
  // would know was ever attempted, tear the room down the same way /destroy
  // does and tell every connected participant why. Returns whether there was
  // a room left to delete, so the caller can tell its own HTTP client
  // whether the room index needs cleaning up too.
  private async failRoom(reason: string): Promise<boolean> {
    let deleted = false;
    try {
      await this.state.storage.transaction(async (txn) => {
        const room = await txn.get<RoomData>("roomData");
        if (!room) return;
        await txn.delete("roomData");
        deleted = true;
      });
    } catch (e) {
      console.error("RoomSession failRoom error:", e);
    }
    if (deleted) this.broadcast({ type: "ROOM_FAILED", payload: { reason } });
    return deleted;
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

      const roomData = {
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

      await this.state.storage.put("roomData", roomData);
      return new Response(JSON.stringify(roomData), { headers: { "Content-Type": "application/json" } });
    }

    const roomData = await this.getRoomData();

    if (!roomData) {
      return new Response("Room not initialized", { status: 404 });
    }

    if (url.pathname === "/state" && request.method === "GET") {
      return new Response(JSON.stringify(roomData), { headers: { "Content-Type": "application/json" } });
    }

    if (url.pathname === "/join" && request.method === "POST") {
      const user = await request.json<JoinRequest>();
      let room: RoomData;
      try {
        ({ room } = await this.updateRoomData((room) => {
          if (room.status !== "waiting") throw new RoomActionError("Room not accepting players");
          if (room.participants[user.id]) throw new RoomActionError("User already joined this room");

          let currentTotalPlayers = 0;
          Object.values(room.participants).forEach((p) => (currentTotalPlayers += p.playerCount));
          if (currentTotalPlayers + user.playerCount > room.maxPlayers) {
            throw new RoomActionError("Room maximum player capacity reached");
          }

          room.participants[user.id] = {
            userId: user.id,
            identifier: user.identifier,
            machineId: user.machineId,
            displayName: user.displayName,
            playerCount: user.playerCount,
            publicKey: user.publicKey,
            ready: false,
            joinedAt: new Date().toISOString(),
          };
        }));
      } catch (e) {
        return this.errorResponse(e);
      }

      this.broadcast({ type: "USER_JOINED", payload: { userId: user.id, identifier: user.identifier } });
      return new Response(JSON.stringify(room), { headers: { "Content-Type": "application/json" } });
    }

    if(url.pathname === "/leave" && request.method === "POST") {
      const user = await request.json<JoinRequest>();
      let room: RoomData;
      try {
        ({ room } = await this.updateRoomData((room) => {
          if (room.status !== "waiting") throw new RoomActionError("Room not accepting players");
          if (!room.participants[user.id]) throw new RoomActionError("User hasn't joined this room");
          delete room.participants[user.id];
        }));
      } catch (e) {
        return this.errorResponse(e);
      }

      this.broadcast({ type: "USER_LEFT", payload: { userId: user.id, identifier: user.identifier } });
      return new Response(JSON.stringify(room), { headers: { "Content-Type": "application/json" } });
    }

    if (url.pathname === "/destroy" && request.method === "POST") {
      const { requestingUserId } = await request.json<any>();
      try {
        await this.state.storage.transaction(async (txn) => {
          const room = await txn.get<RoomData>("roomData");
          if (!room) throw new RoomActionError("Room not initialized", 404);
          if (room.hostUserId !== requestingUserId) throw new RoomActionError("Only room host can destroy room", 403);
          await txn.delete("roomData");
        });
      } catch (e) {
        return this.errorResponse(e);
      }

      // Any participant not currently connected only finds out by hitting
      // the /state 404 above on their next refresh, now that roomData is gone.
      this.broadcast({ type: "ROOM_DESTROYED", payload: {} });
      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    }

    if (url.pathname === "/start" && request.method === "POST") {
      const { requestingUserId } = await request.json<any>();

      // Check and transition waiting -> starting in the same transaction, so
      // a second concurrent /start (or a /join/leave, which both require
      // "waiting") can't slip in and interleave with the coordinator/
      // relay-room calls below, which aren't themselves part of any
      // transaction and take real wall-clock time.
      let room: RoomData;
      try {
        ({ room } = await this.updateRoomData((freshRoom) => {
          this.assertCanStart(freshRoom, requestingUserId);
          freshRoom.status = "starting";
        }));
      } catch (e) {
        return this.errorResponse(e);
      }

      // Told to everyone connected, not just the requester's own HTTP
      // response - otherwise the only participants who find out a start is
      // underway are ones who happen to refresh for an unrelated reason
      // (their own ready-up, someone else joining/leaving) before
      // GAME_HAS_STARTED/ROOM_FAILED eventually arrives.
      this.broadcast({ type: "GAME_IS_STARTING", payload: {} });

      // gameCoordinatorFor only depends on the plugin name and this
      // deployment's own env vars, both fixed well before /start - /room/create
      // already runs this exact check (see index.ts), so hitting it here
      // means the deployment's config drifted after this room was created,
      // not something the host did. Not worth trying to preserve the room
      // for a retry that can't succeed differently.
      let coordinator: GameCoordinatorConfig | false;
      try {
        coordinator = await gameCoordinatorFor(this.env, room.gameLauncherPlugin);
      } catch (e) {
        const message = (e as Error).message;
        const roomDeleted = await this.failRoom(message);
        return new Response(JSON.stringify({ error: message, roomDeleted }), { status: 400 });
      }

      const machines: Array<RoomMachine> = Object.values(room.participants).map((p) => ({
        machineId: p.machineId,
        publicKey: p.publicKey!,
        displayName: p.displayName || p.identifier,
        playerCount: p.playerCount,
      }));

      let relay: { roomId: string };
      try {
        relay = await createRelayRoom(this.env, {
          rosterConfig: room.rosterConfig,
          rosterConfigHash: await createShaFromJSON(room.rosterConfig),
          machines,
          coordinatorId: coordinator ? coordinator.id : false,
        });
      } catch (e) {
        const message = (e as Error).message;
        const roomDeleted = await this.failRoom(message);
        return new Response(JSON.stringify({ error: message, roomDeleted }), { status: 502 });
      }

      try {
        // The room's job ends once the match it exists to set up has
        // started - delete it outright (like /destroy) rather than leaving
        // a "started" row around, so it can't be joined/left/re-started and
        // drops out of the browse index without a further status update.
        // Only commits if this is still the same "starting" room from above
        // - guards against e.g. a concurrent /destroy while the calls above
        // were in flight.
        await this.state.storage.transaction(async (txn) => {
          const freshRoom = await txn.get<RoomData>("roomData");
          if (!freshRoom) throw new RoomActionError("Room not initialized", 404);
          if (freshRoom.hostUserId !== requestingUserId) throw new RoomActionError("Only host can start room", 403);
          if (freshRoom.status !== "starting") throw new RoomActionError("Room is no longer starting");
          await txn.delete("roomData");
        });
      } catch (e) {
        return this.errorResponse(e);
      }

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
      // Attached to the socket itself (survives hibernation) rather than
      // kept in an in-memory Map - this DO can be evicted and woken back up
      // by the runtime to handle a later message/close on this same
      // connection, in a fresh instance that never ran this fetch().
      server.serializeAttachment({ userId, identifier } satisfies WebSocketSession);

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Not found", { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") return;
    const session = ws.deserializeAttachment() as WebSocketSession | null;
    if (!session) return;

    try {
      const data = JSON.parse(message);
      if (data.type === "I_AM_READY") {
        const { result: becameReady } = await this.updateRoomData((room) => {
          if (!room.participants[session.userId]) return false;
          room.participants[session.userId].ready = true;
          return true;
        });

        if (becameReady) {
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
    const session = ws.deserializeAttachment() as WebSocketSession | null;
    if (session) {
      this.broadcast({ type: "USER_LEFT", payload: { userId: session.userId, identifier: session.identifier } });
    }
  }

  private broadcast(msg: any) {
    const payload = JSON.stringify(msg);
    this.state.getWebSockets().forEach((ws) => {
      ws.send(payload);
    });
  }
}
