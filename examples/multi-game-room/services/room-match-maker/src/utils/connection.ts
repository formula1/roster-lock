
import { Request } from "express";
import { ConnectionConfig } from "@roster-lock/types";
import { RoomEntry } from "../store/rooms";

// For direct-tcp, the host's address comes from the request's own source
// address at room-creation time, not client input - a NATed creator usually
// doesn't know their own public IP, and trusting a client-supplied address
// would let a room advertise somewhere other than where it's actually
// reachable.
export function deriveHostAddress(req: Request): string {
  const forwardedFor = req.headers["x-forwarded-for"];
  const forwardedAddress = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(",")[0]?.trim();
  const hostAddress = forwardedAddress || req.socket.remoteAddress;
  if(!hostAddress){
    throw new Error("Could not determine a host address for this direct-tcp room");
  }
  return hostAddress;
}

// A room stores one creator-supplied ConnectionSetup, but each participant
// needs a different ConnectionConfig from it - the creator is always the
// direct-tcp host, everyone else is a client dialing the host's (server-
// resolved) address. "room"/"internal" have no such asymmetry, so every
// participant gets the same value back.
//
// direct-tcp itself is currently unsupported here: ConnectionConfig's
// direct-tcp variants now require a `coordinator` address (see
// plugins/shared/direct-ip-coordinator and
// docs/v2/ikemen-go/game-coordinator.md) - a real rendezvous service a
// client blocks on until the host is confirmed listening. This matchmaker's
// deriveHostAddress predates that design (it resolves an address at
// room-creation time from the request's own source IP, with no "is the host
// actually listening yet" guarantee at all), and doesn't run a coordinator
// service. Wire one up here before re-enabling direct-tcp.
export function connectionConfigFor(room: RoomEntry, viewerPublicKey: string): ConnectionConfig {
  if(room.connection.type === "direct-tcp"){
    throw new Error(
      `Room "${room.roomId}" uses direct-tcp, which this matchmaker doesn't support yet ` +
      `(no coordinator service - see connection.ts)`
    );
  }

  return room.connection;
}
