
import {
  getUsers, syncDownloadOverHTTP, RosterLockV1SyncDLRequestUserToClient
} from "@roster-lock/ts-client";

export async function relayAndDownload(
  request: RosterLockV1SyncDLRequestUserToClient,
){

  const [users, gameResult] = await Promise.all([
    getUsers(request),
    syncDownloadOverHTTP(request),
  ]);

  return { users, gameResult };
}