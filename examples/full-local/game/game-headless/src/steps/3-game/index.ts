
import { prepareWebRTCRoom } from "./webrtc-room";
import { loadAssetsIntoMemory } from "./assets";
import { playGame } from "./play";
import { CurrentUser, RelayRoomConfig, Users, } from "../types";
import { RosterLockV1SyncDLResult } from "@roster-lock/types";

export async function runGame(
  user: CurrentUser,
  relayRoomConfig: RelayRoomConfig,
  users: Users,
  gameResult: RosterLockV1SyncDLResult,
){
  const [room] = await Promise.all([
    prepareWebRTCRoom(relayRoomConfig, users, user),
    loadAssetsIntoMemory(relayRoomConfig, gameResult),
  ]);
  await playGame(room);
}
