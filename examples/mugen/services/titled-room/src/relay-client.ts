import { SIGNATURE } from "@roster-lock/utils";
import { RoomMachine } from "@roster-lock/types";
import { Env } from "./types";

type PrivateKey = Parameters<typeof SIGNATURE.ASYMMETRIC.createSignature>[0];

// Mirrors examples/multi-game-room/services/room-match-maker/src/relay-client.ts -
// titled-room is itself just another registered matchmaker client of the
// Relay Room service (core/relay-server), same integration contract. Unlike
// that example's Node service, the matchmaker's own signing keypair here is
// deployment-provisioned (Worker secrets), not generated-and-persisted to a
// local file - Workers has no filesystem to persist a generated keypair to
// across restarts, and the public half needs to stay stable anyway (it's
// registered ahead of time in relay-server's matchmakers table).
export async function createRelayRoom(env: Env, args: {
  rosterConfig: unknown,
  rosterConfigHash: string,
  machines: Array<RoomMachine>,
  coordinatorId: string | false,
}): Promise<{ roomId: string }> {
  if (!env.RELAY_SERVER_URL) {
    throw new Error("RELAY_SERVER_URL is not configured on this deployment");
  }
  if (!env.MATCHMAKER_PUBLIC_KEY || !env.MATCHMAKER_SECRET_KEY) {
    throw new Error("MATCHMAKER_PUBLIC_KEY/MATCHMAKER_SECRET_KEY are not configured on this deployment");
  }

  const signature = await SIGNATURE.ASYMMETRIC.createSignature(env.MATCHMAKER_SECRET_KEY as PrivateKey, {
    service: "create-room",
    publicKey: env.MATCHMAKER_PUBLIC_KEY,
    rosterConfigHash: args.rosterConfigHash,
    machines: args.machines,
    coordinatorId: args.coordinatorId,
  });

  const response = await fetch(`${env.RELAY_SERVER_URL}/api/v1/room`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      rosterConfig: args.rosterConfig,
      rosterConfigHash: args.rosterConfigHash,
      machines: args.machines,
      coordinatorId: args.coordinatorId,
      publicKey: env.MATCHMAKER_PUBLIC_KEY,
      signature,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create relay room: ${response.status} ${response.statusText}`);
  }
  return await response.json() as { roomId: string };
}
