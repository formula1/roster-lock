import { SIGNATURE, createShaFromJSON } from "@roster-lock/utils";
import { RosterLockV1Config } from "@roster-lock/types";
import { CurrentUser } from "../context/GameSessionContext";

type PrivateKey = Parameters<typeof SIGNATURE.ASYMMETRIC.createSignature>[0];

export type MatchResult = { url: string; roomId: string };

const MAX_ATTEMPTS = 60;

// Ported from game-headless/src/steps/1-matchmaking.ts - plain fetch, so it
// was already browser-safe. Only real change: an onWaiting callback so the
// UI can show live status instead of headless's console logging.
export async function joinMatch(
  user: CurrentUser,
  rosterConfig: RosterLockV1Config,
  matchmakingUrl: string,
  onWaiting?: (attempt: number) => void,
): Promise<MatchResult> {
  const rosterHash = await createShaFromJSON(rosterConfig);
  await enterQueue(matchmakingUrl, user, rosterHash, rosterConfig);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const status = await checkStatus(matchmakingUrl, user, rosterHash);
    if (status.status === "matched") return { url: status.url, roomId: status.roomId };
    onWaiting?.(attempt);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Timed out waiting for match");
}

async function enterQueue(
  matchmakingUrl: string,
  user: CurrentUser,
  rosterHash: string,
  rosterConfig: RosterLockV1Config,
) {
  const timestamp = Date.now();
  const signature = await SIGNATURE.ASYMMETRIC.createSignature(user.keys.privateKey as PrivateKey, {
    service: "join-queue",
    machineId: user.machineId,
    displayName: user.displayName,
    rosterHash,
    timestamp,
    publicKey: user.keys.publicKey,
  });

  const response = await fetch(`${matchmakingUrl}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      machineId: user.machineId,
      displayName: user.displayName,
      rosterConfig,
      publicKey: user.keys.publicKey,
      timestamp,
      signature,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to join matchmaking queue (${response.status})`);
  }
  return (await response.json()) as { status: string; position: number; queuedAt: number };
}

type Status = { status: "waiting" } | { status: "matched"; roomId: string; url: string };

async function checkStatus(matchmakingUrl: string, user: CurrentUser, rosterHash: string): Promise<Status> {
  const timestamp = Date.now();
  const signature = await SIGNATURE.ASYMMETRIC.createSignature(user.keys.privateKey as PrivateKey, {
    service: "queue-status",
    rosterConfigHash: rosterHash,
    timestamp,
    publicKey: user.keys.publicKey,
  });

  const url = new URL(`/status/${rosterHash}`, matchmakingUrl);
  url.searchParams.append("publicKey", user.keys.publicKey);
  url.searchParams.append("signature", signature);
  url.searchParams.append("timestamp", timestamp.toString());

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to check match status (${response.status})`);
  }
  return (await response.json()) as Status;
}
