
import {
  RosterLockV1SyncDLRequestUserToClient,
  RosterLockV1SyncDLRequestClientToAgent,
  RosterLockV1SyncDLResult,
} from "@roster-lock/types";
import { SIGNATURE } from "@roster-lock/utils";
import { HTTPError } from "../utils/fetch";

import { ROSTERLOCK_MATCH_AGENT_URL } from "../constants/match-agent";

type PrivateKey = Parameters<typeof SIGNATURE.ASYMMETRIC.createSignature>[0];

export async function syncDownloadOverHTTP(
  {
    version,
    folder,
    relay,
    user,
    rosterConfig,
    userSelection: selection,
  }: RosterLockV1SyncDLRequestUserToClient,
  matchAgentAuth: string,
  matchAgentUrl: string | URL = ROSTERLOCK_MATCH_AGENT_URL,
): Promise<RosterLockV1SyncDLResult>{
  if(version !== 1) throw new Error(`Unsupported Version ${version}`);
  const syncDLURL = new URL("/v1/sync-dl", matchAgentUrl);
  if(!["http:", "https:"].includes(syncDLURL.protocol)){
    throw new Error("Expecting The match agent url to be http or https");
  }
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


  const response = await fetch(syncDLURL.href, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + matchAgentAuth
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


