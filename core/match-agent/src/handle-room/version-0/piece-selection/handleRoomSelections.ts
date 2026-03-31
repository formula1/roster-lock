import { JSON_Unknown, RosterLockV1Config, UserInput } from "@match-lock/shared";
import { MATCHLOCK_SELECTION_STATE, UserMessegeError } from "./constants";
import {
  encryptJSON, decryptJSON,
  CastEncryptedMessage,
} from "./steps/encrypton";
import {
  validatePlayerSelection, createRandomSeed,
  PlayerSelectionWithSeed
} from "./steps/player-selection";
import {
  finalizeSelection,
  FinalSelection,
  CastFinalSelection
} from "./steps/final-selection";
import { Room } from "../../../types/room";
import { deepEqual } from "node:assert";

const STATE_ORDER = [
  MATCHLOCK_SELECTION_STATE.hello,
  MATCHLOCK_SELECTION_STATE.restriction,
  MATCHLOCK_SELECTION_STATE.selectionEncrypt,
  MATCHLOCK_SELECTION_STATE.selectionDecrypt,
  MATCHLOCK_SELECTION_STATE.selectionFinal,
  MATCHLOCK_SELECTION_STATE.goodbye,
];

export async function handleRoomSelections(
  room: Room,
  abortSignal: AbortSignal,
  restriction: RosterLockV1Config,
  selection: UserInput["userSelection"],
){

  const rngSeed = createRandomSeed();
  const [ownEncrypted] = await Promise.all([
    // Prepare own Selections
    encryptJSON({ selection, rngSeed }),
    // Validate our own selection
    validatePlayerSelection(restriction, { selection, rngSeed })
  ])

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

class RoomState {
  private state: MATCHLOCK_SELECTION_STATE = MATCHLOCK_SELECTION_STATE.hello;
  private recievedMessages = new Map<MATCHLOCK_SELECTION_STATE, Set<string>>();

  encryptedData = new Map<string, { iv: string, ciphertext: string }>();
  userSelections = new Map<string, PlayerSelectionWithSeed>();
  agreedSelection: FinalSelection | null = null;

  constructor(
    public room: Room,
    public restriction: RosterLockV1Config,
    public ownEncrypted: Awaited<ReturnType<typeof encryptJSON>>,
  ){}

  validateMessageState(
    userId: string,
    messageState: MATCHLOCK_SELECTION_STATE
  ){
    if(this.state !== messageState){
      const currentIndex = STATE_ORDER.indexOf(this.state);
      const messageIndex = STATE_ORDER.indexOf(messageState);
      if(messageIndex === currentIndex + 1){
        console.warn(`User Sent ${messageState} Early`, userId);
        console.warn("We'll still process it as other messages may just be late");
      } else {
        throw new UserMessegeError(userId, `Expected ${this.state} message`);
      }
    }
    if(!this.recievedMessages.has(messageState)){
      this.recievedMessages.set(messageState, new Set());
    }
    if(this.recievedMessages.get(messageState)!.has(userId)){
      throw new UserMessegeError(userId, "User Sent Message Twice");
    }
    this.recievedMessages.get(messageState)!.add(userId);
    return this.recievedMessages.get(messageState)!.size;
  }

  updateStep(){
    const currentIndex = STATE_ORDER.indexOf(this.state);
    const nextIndex = currentIndex + 1;
    if (nextIndex >= STATE_ORDER.length) {
      throw new Error("No next phase after " + this.state);
    }
    this.state = STATE_ORDER[nextIndex];
  }

  stateHandlers: Record<string, {
    message?(userId: string, data: JSON_Unknown):any,
    finished():any
  }> = {
    [MATCHLOCK_SELECTION_STATE.hello]: {
      finished: ()=>(
        this.room.broadcast(MATCHLOCK_SELECTION_STATE.restriction, this.restriction)
      ),
    },
    [MATCHLOCK_SELECTION_STATE.restriction]: {
      message: (userId, data)=>{
        deepEqual(data, this.restriction, "Restriction Mismatch")
      },
      finished: ()=>(
        this.room.broadcast(MATCHLOCK_SELECTION_STATE.selectionEncrypt, this.ownEncrypted.encrypted)
      )
    },
    [MATCHLOCK_SELECTION_STATE.selectionEncrypt]: {
      message: (userId, data)=>{
        const casted = CastEncryptedMessage.check(data);
        this.encryptedData.set(userId, casted);
      },
      finished: ()=>(
        this.room.broadcast(MATCHLOCK_SELECTION_STATE.selectionDecrypt, this.ownEncrypted.key)
      )
    },
    [MATCHLOCK_SELECTION_STATE.selectionDecrypt]: {
      message: async (userId, data)=>{
        if(typeof data !== "string") throw new Error("Invalid Decryption Key");
        const encrypted = this.encryptedData.get(userId);
        if(!encrypted) throw new Error("Missing Encrypted Data");
        const decrypted = await decryptJSON(data, encrypted);
        const casted = await validatePlayerSelection(this.restriction, decrypted);
        this.userSelections.set(userId, casted);
      },
      finished: async ()=>{
        const ownFinalSelection = await finalizeSelection(
          this.restriction, Object.fromEntries(this.userSelections)
        );
        this.room.broadcast(MATCHLOCK_SELECTION_STATE.selectionFinal, ownFinalSelection)
      }
    },
    [MATCHLOCK_SELECTION_STATE.selectionFinal]: {
      message: (userId, data)=>{
        const casted: FinalSelection = CastFinalSelection.check(data);
        if(this.agreedSelection === null){
          this.agreedSelection = casted;
        } else {
          deepEqual(this.agreedSelection, casted, "Final Selection Mismatch");
        }
      },
      finished: ()=>(
        this.room.broadcast(MATCHLOCK_SELECTION_STATE.goodbye, "goodbye")
      )
    },
    [MATCHLOCK_SELECTION_STATE.goodbye]: {
      finished: ()=>{},
    }
  }
}

