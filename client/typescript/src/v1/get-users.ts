
import { RosterLockV1SyncDLRequestUserToClient } from "@roster-lock/types";
import { SIGNATURE } from "@roster-lock/utils";

type PrivateKey = Parameters<typeof SIGNATURE.ASYMMETRIC.createSignature>[0];


type Machine = {
  machineId: string;
  publicKey: string;
  displayName: string;
  playerCount: number;
  connected: boolean;
  connectedAt?: string
}

export async function getMachines(
  {
    machine, relay,
  }: Pick<RosterLockV1SyncDLRequestUserToClient, "machine" | "relay">
){
  const timestamp = Date.now();
  const signature = await SIGNATURE.ASYMMETRIC.createSignature(
    machine.keys.privateKey as PrivateKey,
    {
      service: 'room-ws',
      roomId: relay.roomId,
      publicKey: machine.keys.publicKey,
      timestamp: timestamp,
    }
  );
  return await getRoomMachines(relay.url, {
    room: relay.roomId,
    timestamp,
    publicKey: machine.keys.publicKey,
    signature,
  });
}


type ReqParams = {
  room: string,
  timestamp: number,
  publicKey: string,
  signature: string,
}
async function getRoomMachines(url: string, params: ReqParams){
  const roomURL = new URL(`/api/v1/room/${params.room}/machines`, url);
  roomURL.searchParams.set("room", params.room);
  roomURL.searchParams.set("t", params.timestamp.toString());
  roomURL.searchParams.set("pk", params.publicKey);
  roomURL.searchParams.set("sig", params.signature);

  const response = await fetch(roomURL);
  if(!response.ok) throw new Error("Failed to get room machines");
  return await response.json() as Array<Machine>;
}
