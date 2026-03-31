
import {
  RosterLockV1SyncDLRequestUserToClient,
  RosterLockV1SyncDLRequestClientToAgent,
  RosterLockV1SyncDLResult,
} from "@roster-lock/types";
import { signMessage } from "../utils/crypto";
import { HTTPError } from "../utils/fetch";

import { ROSTERLOCK_MATCH_AGENT_URL } from "../constants/match-agent";
const syncDLURL = new URL("/v1/sync-dl", ROSTERLOCK_MATCH_AGENT_URL);

export async function syncDownloadOverHTTP(
  {
    version,
    folder,
    relay,
    user,
    rosterConfig,
    userSelection: selection,
  }: RosterLockV1SyncDLRequestUserToClient,
): Promise<RosterLockV1SyncDLResult>{
  if(version !== 1) throw new Error(`Unsupported Version ${version}`);
  const timestamp = Date.now();
  const signature = await signMessage(user.keys.privateKey, {
    service: 'room-ws',
    roomId: relay.roomId,
    publicKey: user.keys.publicKey,
    timestamp: timestamp,
  });


  const response = await fetch(syncDLURL.href, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      folder: folder,
      relay: relay,
      user: { timestamp, publicKey: user.keys.publicKey, signature },
      rosterConfig,
      userSelection: selection,
    } satisfies RosterLockV1SyncDLRequestClientToAgent)
  });

  const json = await response.json();

  if(!response.ok){
    throw new HTTPError(
      syncDLURL, "POST", response, json
    );
  }

  return json as RosterLockV1SyncDLResult;
}


