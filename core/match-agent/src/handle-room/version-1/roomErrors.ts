
import { Room } from "../../types/room";
import { ExternalUserError, ROOM_EVENT, MATCHLOCK_DOWNLOAD_STATE, MATCHLOCK_SELECTION_STATE } from "./constants";

import { waitForEvent, waitForEventTimeout } from "@match-lock/shared";
export async function waitForExternalError<T>(
  room: Room, abortSignal: AbortSignal
): Promise<T> {
  const [userId, event, message] = await waitForEvent(
    room.listen.filter((userId, event, message)=>{
      if(event === ROOM_EVENT.userLeft) return true;
      if(event === MATCHLOCK_SELECTION_STATE.failure) return true;
      if(event === MATCHLOCK_DOWNLOAD_STATE.downloadFullFailure) return true;
      return false;
    }),
    abortSignal
  )
  throw new ExternalUserError(userId, message);
}

export async function waitForStoppedRoomHeartbeat<T>(
  room: Room, timeout: number, abortSignal: AbortSignal
): Promise<T> {
  await waitForEventTimeout(
    room.listen.filter((userId, event, message)=>{
      if(event === ROOM_EVENT.userLeft) return false;
      if(event === MATCHLOCK_SELECTION_STATE.failure) return false;
      if(event === MATCHLOCK_DOWNLOAD_STATE.downloadFullFailure) return false;
      return true;
    }),
    timeout,
    abortSignal
  );
  throw new Error("Heartbeat Timeout");
}
