import { RosterLockV1Config, UserInput } from "@match-lock/shared";

import { Room } from "../../../types/room";
import { waitForExternalError, waitForStoppedRoomHeartbeat } from "./roomErrors";
import { handleRoomSelections } from "./handleRoomSelections";
import { ExternalUserError, MATCHLOCK_SELECTION_STATE } from "./constants";

export async function handleSelection(
  room: Room,
  lockConfig: RosterLockV1Config,
  selection: UserInput["userSelection"]
){
  const abortController = new AbortController();
  try {
    await Promise.race([
      handleRoomSelections(room, abortController.signal, lockConfig, selection),
      waitForExternalError(room, abortController.signal),
      waitForStoppedRoomHeartbeat(room, 10_000, abortController.signal),
    ])
  }catch(e){
    console.log("Match To Start Failed", e);
    if(!(e instanceof ExternalUserError) && e instanceof Error){
      room.broadcast(MATCHLOCK_SELECTION_STATE.failure, e.message);
    }
    room.disconnect();
    throw e;
  }finally{
    abortController.abort();
  }
}

