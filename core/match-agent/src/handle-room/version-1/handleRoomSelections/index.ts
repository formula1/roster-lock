import { RosterLockV1Config, UserInput } from "@match-lock/shared";
import { MATCHLOCK_SELECTION_STATE } from "../constants";
import {
  encryptJSON, decryptJSON,
} from "./encryption";
import { createRandomSeed } from "./random";
import { FinalSelection } from "@match-lock/shared";
import { Room } from "../../../types/room";
import { RoomState } from "./RoomState";

export async function handleRoomSelections(
  room: Room,
  abortSignal: AbortSignal,
  restriction: RosterLockV1Config,
  selection: UserInput["userSelection"],
){

  const rngSeed = createRandomSeed();
  const ownEncrypted = await encryptJSON({ selection, rngSeed })

  if(abortSignal.aborted){
    return Promise.reject(new Error("Aborted"));
  }

  const roomState = new RoomState(
    room, restriction, ownEncrypted
  );

  const { promise, resolve, reject } = Promise.withResolvers<FinalSelection>();

  // Send our "hello" after we start listening
  Promise.resolve().then(async ()=>{
    room.broadcast(MATCHLOCK_SELECTION_STATE.hello, "hello");
  });
  const stopListeningToRoom = room.listen(async (userId, event, data)=>{
    try {
      if(!(event in roomState.stateHandlers )){
        return;
      }
      // ensure the message wasn't sent twice and event is in order
      const count = roomState.validateMessageState(userId, event as MATCHLOCK_SELECTION_STATE);
      const { message, finished } = roomState.stateHandlers[event];
      // If there is a message handler, run it
      await message?.(userId, data);
      // If we haven't heard from everyone, exit
      if(count < room.numberOfUsers) return;
      // Update the room step
      roomState.updateStep();
      // Run the finished handler which includes broadcasting the next step
      await finished();

      // If we're in the goodbye state, we're done
      if(event !== MATCHLOCK_SELECTION_STATE.goodbye) return;
      if(!roomState.agreedSelection) throw new Error("Missing Agreed FInal Selection");
      resolve(roomState.agreedSelection!);
    }catch(e){
      reject(e);
    }
  });

  promise.finally(()=>{
    stopListeningToRoom();
  });

  abortSignal.addEventListener("abort", ()=>(
    reject(new Error("Aborted"))
  ));

  return promise;

}

