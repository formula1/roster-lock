
import { RosterLockV1SyncDLRequestUserToClient } from "@roster-lock/types";
import { signMessage } from "../utils/crypto";

type User = {
  userId: string;
  publicKey: string;
  displayName: string;
  connected: boolean;
  connectedAt?: string
}

export async function getUsers(
  {
    user, relay,
  }: Pick<RosterLockV1SyncDLRequestUserToClient, "user" | "relay">
){
  const timestamp = Date.now();
  const signature = await signMessage(user.keys.privateKey, {
    service: 'room-ws',
    roomId: relay.roomId,
    publicKey: user.keys.publicKey,
    timestamp: timestamp,
  });
  return await getRoomUsers(relay.url, {
    room: relay.roomId,
    timestamp,
    publicKey: user.keys.publicKey,
    signature,
  });
}


type ReqParams = {
  room: string,
  timestamp: number,
  publicKey: string,
  signature: string,
}
async function getRoomUsers(url: string, params: ReqParams){
  const roomURL = new URL(`/api/v1/rooms/${params.room}/users`, url);
  const searchParams = new URLSearchParams();
  searchParams.set("room", params.room);
  searchParams.set("t", params.timestamp.toString());
  searchParams.set("pk", params.publicKey);
  searchParams.set("sig", params.signature);

  const response = await fetch(roomURL, {
    headers: {
      "Content-Type": "application/json",
    },
    body: searchParams.toString(),
  });
  if(!response.ok) throw new Error("Failed to get room users");
  return await response.json() as Array<User>;
}
