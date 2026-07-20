
import { prepareWebRTCRoom } from "./datachannel-room";
import { loadAssetsIntoMemory } from "./assets";
import { playGame } from "./play";
import { CurrentUser, RelayRoomConfig, Users, } from "../types";
import { RosterLockV1SyncDLResult } from "@roster-lock/types";
import { PieceFilesConfig } from "@roster-lock/example-game-engine";

export async function runGame(
  user: CurrentUser,
  relayRoomConfig: RelayRoomConfig,
  users: Users,
  gameResult: RosterLockV1SyncDLResult,
  pieceFiles: PieceFilesConfig,
){
  const [room] = await Promise.all([
    prepareWebRTCRoom(relayRoomConfig, users, user),
    loadAssetsIntoMemory(relayRoomConfig, gameResult),
  ]);
  // The signaling socket and WebRTC peers/datachannel threads keep the
  // process alive after the game ends unless explicitly torn down here.
  try {
    return await playGame(room, user, gameResult, pieceFiles);
  } finally {
    room.close();
  }
}
