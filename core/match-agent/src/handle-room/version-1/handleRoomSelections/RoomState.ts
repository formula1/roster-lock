import {
  JSON_Unknown,
  RosterLockV1Config,
  UserInput,
  FinalSelection
} from "@match-lock/shared";
import { MATCHLOCK_SELECTION_STATE, UserMessegeError } from "../constants";
import { Room } from "../../../types/room";
import { deepEqual } from "node:assert";
import { validateUnknown } from "../validateUnknown";

import { decryptJSON, encryptJSON, encryptedSchema } from "./encryption";
import { userInputSchema, finalizeSelection, finalSelectionSchema } from "./user-selection";

const STATE_ORDER = [
  MATCHLOCK_SELECTION_STATE.hello,
  MATCHLOCK_SELECTION_STATE.lockConfig,
  MATCHLOCK_SELECTION_STATE.selectionEncrypt,
  MATCHLOCK_SELECTION_STATE.selectionDecrypt,
  MATCHLOCK_SELECTION_STATE.selectionFinal,
  MATCHLOCK_SELECTION_STATE.goodbye,
];

export class RoomState {
  private state: MATCHLOCK_SELECTION_STATE = MATCHLOCK_SELECTION_STATE.hello;
  private recievedMessages = new Map<MATCHLOCK_SELECTION_STATE, Set<string>>();

  encryptedData = new Map<string, { iv: string, ciphertext: string }>();
  userSelections = new Map<string, UserInput>();
  agreedSelection: FinalSelection | null = null;

  constructor(
    public room: Room,
    public lockConfig: RosterLockV1Config,
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
        this.room.broadcast(MATCHLOCK_SELECTION_STATE.lockConfig, this.lockConfig)
      ),
    },
    [MATCHLOCK_SELECTION_STATE.lockConfig]: {
      message: (userId, data)=>{
        deepEqual(data, this.lockConfig, "Restriction Mismatch")
      },
      finished: ()=>(
        this.room.broadcast(MATCHLOCK_SELECTION_STATE.selectionEncrypt, this.ownEncrypted.encrypted)
      )
    },
    [MATCHLOCK_SELECTION_STATE.selectionEncrypt]: {
      message: (userId, data)=>{
        const casted = validateUnknown(encryptedSchema, data);
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
        const casted = await validateUnknown(userInputSchema, decrypted);
        this.userSelections.set(userId, casted);
      },
      finished: async ()=>{
        const ownFinalSelection = await finalizeSelection(
          this.lockConfig, {}, {}, Object.fromEntries(this.userSelections)
        );
        this.agreedSelection = ownFinalSelection;
        this.room.broadcast(MATCHLOCK_SELECTION_STATE.selectionFinal, ownFinalSelection)
      }
    },
    [MATCHLOCK_SELECTION_STATE.selectionFinal]: {
      message: (userId, data)=>{
        const casted: FinalSelection = validateUnknown(finalSelectionSchema, data);
        deepEqual(this.agreedSelection, casted, "Final Selection Mismatch");
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

