
import { randomUUID } from "node:crypto";
import { createShaFromJSON } from "@roster-lock/utils";
import { CreateRoomBody, ConnectionSetup } from "../schema";

export type RoomPlayer = {
  machineId: string,
  publicKey: string,
  displayName: string,
  playerCount: number,
  ready: boolean,
};

export type RoomStatus = "open" | "matching" | "relaying" | "failed";

export type RoomEntry = {
  roomId: string,
  title: string,
  rosterConfig: unknown,
  rosterConfigHash: string,
  engineSha: string,
  gamePluginPackage: string,
  maxPlayers: number,
  // Raw creator input - not a per-viewer ConnectionConfig. The room creator
  // is always the host (see general-plan.md); who's "host" vs "client" and,
  // for direct-tcp, the host's resolved address, only get worked out
  // per-requester in routes/connection.ts, since the creator and every other
  // participant get a different ConnectionConfig from the same room.
  connection: ConnectionSetup,
  // Only set (and only meaningful) when connection.type === "direct-tcp" -
  // derived from the creator's own request source address at creation time
  // (see routes/rooms.ts), never trusted from client input.
  hostAddress?: string,
  gameConfig: unknown,
  creatorMachineId: string,
  creatorPublicKey: string,
  players: Array<RoomPlayer>,
  status: RoomStatus,
  createdAt: number,
  relay?: { roomId: string, url: string },
  failureReason?: string,
};

const rooms = new Map<string, RoomEntry>();

export async function createRoom(
  body: CreateRoomBody,
  hostAddress: string | undefined,
): Promise<RoomEntry> {
  const rosterConfigHash = await createShaFromJSON(body.rosterConfig);
  const room: RoomEntry = {
    roomId: randomUUID(),
    title: body.title,
    rosterConfig: body.rosterConfig,
    rosterConfigHash,
    engineSha: body.engineSha,
    gamePluginPackage: body.gamePluginPackage,
    maxPlayers: body.maxPlayers,
    connection: body.connection,
    hostAddress: body.connection.type === "direct-tcp" ? hostAddress : undefined,
    gameConfig: body.gameConfig,
    creatorMachineId: body.creator.machineId,
    creatorPublicKey: body.creator.publicKey,
    players: [{
      machineId: body.creator.machineId,
      publicKey: body.creator.publicKey,
      displayName: body.creator.displayName,
      playerCount: body.creator.playerCount,
      ready: false,
    }],
    status: "open",
    createdAt: Date.now(),
  };
  rooms.set(room.roomId, room);
  return room;
}

export function listOpenRooms(): Array<RoomEntry> {
  return Array.from(rooms.values()).filter((room) => room.status === "open");
}

export function getRoom(roomId: string): RoomEntry | undefined {
  return rooms.get(roomId);
}

export function joinRoom(
  roomId: string,
  player: Omit<RoomPlayer, "ready">,
): RoomEntry {
  const room = requireRoom(roomId);
  if(room.status !== "open"){
    throw new Error(`Room "${roomId}" is no longer open (status: ${room.status})`);
  }
  if(room.players.some((p) => p.publicKey === player.publicKey)){
    throw new Error("Already joined this room");
  }
  if(room.players.length >= room.maxPlayers){
    throw new Error(`Room "${roomId}" is full (${room.maxPlayers} players)`);
  }
  room.players.push({ ...player, ready: false });
  return room;
}

// Returns the room, plus whether every current player just became ready as
// of this call - the caller uses that edge to decide whether to kick off
// relay-room creation. "All ready" requires the room to have actually
// reached maxPlayers, not just that whoever happened to join is ready -
// otherwise 2 of an intended 6 (3v3) marking ready would start the match
// short. Marking ready doesn't lock the roster; a player can still join
// after others are ready (dropping the count back below maxPlayers reopens
// the gate automatically, since this check re-evaluates every call).
export function markSelectionReady(
  roomId: string,
  publicKey: string,
): { room: RoomEntry, allReady: boolean } {
  const room = requireRoom(roomId);
  if(room.status !== "open"){
    throw new Error(`Room "${roomId}" is no longer open (status: ${room.status})`);
  }
  const player = room.players.find((p) => p.publicKey === publicKey);
  if(!player) throw new Error("Not a participant in this room");
  player.ready = true;

  const allReady = room.players.length === room.maxPlayers && room.players.every((p) => p.ready);
  if(allReady) room.status = "matching";
  return { room, allReady };
}

export function setRelayResult(roomId: string, relay: { roomId: string, url: string }): void {
  const room = requireRoom(roomId);
  room.relay = relay;
  room.status = "relaying";
}

export function setRoomFailed(roomId: string, reason: string): void {
  const room = requireRoom(roomId);
  room.status = "failed";
  room.failureReason = reason;
}

function requireRoom(roomId: string): RoomEntry {
  const room = rooms.get(roomId);
  if(!room) throw new Error(`Room "${roomId}" not found`);
  return room;
}
