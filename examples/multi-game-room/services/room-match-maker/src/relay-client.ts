
import { RoomMachine } from "@roster-lock/types";
import { SIGNATURE } from "@roster-lock/utils";
import { getSignatureKeys } from "./globals/signature-keys";
import { GAME_COORDINATOR_ID, RELAY_SERVER_URL } from "./globals/env";

type PrivateKey = Parameters<typeof SIGNATURE.ASYMMETRIC.createSignature>[0];

// Mirrors examples/full-local/services/matchmaking's createMatch - the Room
// Match Maker is itself just a registered matchmaker client of the Relay
// Room service, same integration contract, different matching strategy
// (advertised rooms here vs. that service's queue-based auto-pairing).
export async function createRelayRoom(args: {
  rosterConfig: unknown,
  rosterConfigHash: string,
  machines: Array<RoomMachine>,
}): Promise<{ roomId: string }> {
  const { publicKey, secretKey } = await getSignatureKeys();
  const signature = await SIGNATURE.ASYMMETRIC.createSignature(secretKey as PrivateKey, {
    service: "create-room",
    publicKey,
    rosterConfigHash: args.rosterConfigHash,
    machines: args.machines,
    coordinatorId: GAME_COORDINATOR_ID,
  });

  const response = await fetch(`${RELAY_SERVER_URL}/api/v1/room`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      rosterConfig: args.rosterConfig,
      rosterConfigHash: args.rosterConfigHash,
      machines: args.machines,
      coordinatorId: GAME_COORDINATOR_ID,
      publicKey,
      signature,
    }),
  });

  if(!response.ok){
    throw new Error(`Failed to create relay room: ${response.status} ${response.statusText}`);
  }

  return await response.json() as { roomId: string };
}
