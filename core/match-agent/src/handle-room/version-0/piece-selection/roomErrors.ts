
import { Room } from "../../../types/room";
import { ExternalUserError, MATCHLOCK_SELECTION_STATE } from "./constants";

import { waitForEvent, waitForEventTimeout } from "@match-lock/shared";
export async function waitForExternalError(room: Room, abortSignal: AbortSignal){
  const [userId, event, message] = await waitForEvent(
    room.listen.filter((userId, event, message)=>{
      return event === MATCHLOCK_SELECTION_STATE.failure;
    }),
    abortSignal
  )
  throw new ExternalUserError(userId, message);
}

export async function waitForStoppedRoomHeartbeat(room: Room, timeout: number, abortSignal: AbortSignal){
  await waitForEventTimeout(
    room.listen.filter((userId, event, message)=>{
      return event !== MATCHLOCK_SELECTION_STATE.failure;
    }),
    timeout,
    abortSignal
  );
  throw new Error("Heartbeat Timeout");
}
