import { CurrentUser } from "./types";
import { signMessage, createSha } from "../utils/crypto";
import { HTTPError } from "../utils/fetch";
import { RosterLockV1Config } from "@roster-lock/types";


const MAX_ATTEMPTS = 60;
export async function joinMatch(user: CurrentUser, rosterConfig: RosterLockV1Config, matchmakingUrl: string) {
  const rosterHash = await createSha(rosterConfig);
  await enterQueue(matchmakingUrl, user, rosterHash, rosterConfig);

  for(let attempt = 0; attempt < MAX_ATTEMPTS; attempt++){
    const status = await checkStatus(matchmakingUrl, user, rosterHash);
    if(status.status === 'matched') return { url: status.url, roomId: status.roomId };
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error("Timed out waiting for match");
}

async function enterQueue(matchmakingUrl: string, user: CurrentUser, rosterHash: string, rosterConfig: RosterLockV1Config) {
  const url = new URL('/join', matchmakingUrl);
  const timestamp = Date.now();
  const signature = await signMessage(user.keys.privateKey, {
    service: 'join-queue',
    userId: user.userId,
    displayName: user.displayName,
    rosterHash: rosterHash,
    timestamp: timestamp,
    publicKey: user.keys.publicKey,
  });

  const response = await fetch(`${matchmakingUrl}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: user.userId,
      displayName: user.displayName,
      rosterConfig: rosterConfig,
      publicKey: user.keys.publicKey,
      timestamp: timestamp,
      signature: signature,
    })
  });

  if (!response.ok) {
    throw new HTTPError(url, 'POST', response, await response.json(), "Failed to join queue");
  }

  const json = await response.json() as { status: string, position: number, queuedAt: number };

  return json;
}

type Status = (
  | { status: 'waiting' }
  | { status: 'matched', roomId: string, url: string }
);
async function checkStatus(matchmakingUrl: string, user: CurrentUser, rosterHash: string){
  const timestamp = Date.now();
  const signature = await signMessage(user.keys.privateKey, {
    service: 'queue-status',
    rosterConfigHash: rosterHash,
    timestamp: timestamp,
    publicKey: user.keys.publicKey,
  });

  const url = new URL(`/status/${rosterHash}`, matchmakingUrl);
  url.searchParams.append('publicKey', user.keys.publicKey);
  url.searchParams.append('signature', signature);
  url.searchParams.append('timestamp', timestamp.toString());

  const response = await fetch(url);
  if (!response.ok) {
    throw new HTTPError(url, 'GET', response, await response.json(), "Failed to check status");
  }

  const json = await response.json() as Status;

  return json;
}
