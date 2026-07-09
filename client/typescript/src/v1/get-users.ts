
import { RosterLockV1SyncDLRequestUserToClient } from "@roster-lock/types";
import { SIGNATURE } from "@roster-lock/utils";

type PrivateKey = Parameters<typeof SIGNATURE.ASYMMETRIC.createSignature>[0];


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
  const signature = await SIGNATURE.ASYMMETRIC.createSignature(
    user.keys.privateKey as PrivateKey,
    {
      service: 'room-ws',
      roomId: relay.roomId,
      publicKey: user.keys.publicKey,
      timestamp: timestamp,
    }
  );
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
  const roomURL = new URL(`/api/v1/room/${params.room}/users`, url);
  roomURL.searchParams.set("room", params.room);
  roomURL.searchParams.set("t", params.timestamp.toString());
  roomURL.searchParams.set("pk", params.publicKey);
  roomURL.searchParams.set("sig", params.signature);

  const response = await fetch(roomURL);
  if(!response.ok) throw new Error("Failed to get room users");
  return await response.json() as Array<User>;
}
