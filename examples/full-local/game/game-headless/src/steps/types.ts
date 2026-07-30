import {
  RosterLockV1SyncDLRequestUserToClient,
  RosterLockV1SyncDLResult,
} from "@roster-lock/types";

export type CurrentUser = (
  & RosterLockV1SyncDLRequestUserToClient["machine"]
  & { displayName: string }
);

export type RelayRoomConfig = RosterLockV1SyncDLRequestUserToClient["relay"];

export type Users = Array<{
  machineId: string,
  publicKey: string,
  displayName: string,
  playerCount: number,
}>
