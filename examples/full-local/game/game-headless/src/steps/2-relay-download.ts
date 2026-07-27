
import {
  getMachines, syncDownloadOverHTTP, RosterLockV1SyncDLRequestUserToClient
} from "@roster-lock/ts-client";

export async function relayAndDownload(
  request: RosterLockV1SyncDLRequestUserToClient,
  matchAgentAuth: string,
  matchAgentUrl: string,
){

  const [users, gameResult] = await Promise.all([
    getMachines(request),
    syncDownloadOverHTTP(request, matchAgentAuth, matchAgentUrl),
  ]);

  return { users, gameResult };
}