
import { MessageBridge } from "../../../utils/MessageBridge";
import {
  FinalSelection, RosterLockV1Config, SelectedPiece, UserSelection,
  RosterLockV1SyncDLResult
} from "@roster-lock/types";
import { runSelection } from "@roster-lock/shared";
import { encryptJSON, decryptJSON } from "../handleRoomSelections/encryption";
import { createRandomSeed } from "../handleRoomSelections/random";
import { z, ZodType } from "zod";
import { UserSelectionSchema } from "../schema/selected";
import { runUntrustedScript } from "@roster-lock/node-services";
import { handleDownloads } from "../handleDownloads";
import { IFolderDB } from "../globals/FolderDB";
import { RosterLockDownloadUpdate } from "@roster-lock/types";

type UserPublicKey = string;

type EncryptedValue = Awaited<ReturnType<typeof encryptJSON>>;

type RoomState = (
  | { state: "user-selection" }
  | { state: "all-selection-for-user-decryption" }
  | { state: "all-decryption-for-user-final", encrypted: Record<UserPublicKey, EncryptedValue["encrypted"]> }
  | { state: "user-download", finalSelection: FinalSelection }
  | { state: "all-download", finalSelection: FinalSelection, downloadResults: Awaited<ReturnType<typeof handleDownloads>> }
  | { state: "ended" }
)

type RoomArgs = {
  bridge: MessageBridge,
  fileDB: IFolderDB,
  users: Array<{ publicKey: UserPublicKey }>,
  ownSelection: UserSelection,
  lockConfig: RosterLockV1Config,
  scriptsByPath: Record<string, string>,
  gameControlledSelections: Record<string, Array<SelectedPiece> | Record<UserPublicKey, Array<SelectedPiece>>>,
}

export type ProgressListeners = Partial<{
  onState: (state: string)=>void,
  onDownloadProgress: (update: RosterLockDownloadUpdate)=>void,
}>

type UserInput = {
  userSelection: UserSelection,
  randomSeed: string,
}

export function bindStepsToBridge(
  {
    bridge,
    fileDB,
    users,
    ownSelection,
    lockConfig,
    scriptsByPath,
    gameControlledSelections,
  }: RoomArgs,
  progressListeners: ProgressListeners = {}
): Promise<RosterLockV1SyncDLResult>{
  const { resolve, reject, promise } = Promise.withResolvers<RosterLockV1SyncDLResult>();
  const downloadAbort = new AbortController();
  const heartbeat = trackHeartbeat(10_000);
  const stateTracker = new StateTracker({ state: "user-selection" }, progressListeners);

  const rngSeed = createRandomSeed();
  const ownEncrypted = encryptJSON({ selection: ownSelection, rngSeed })

  bridge.onRequest("ping", ()=>{
    heartbeat.heartBeat();
    return "pong";
  });

  // Return Encrypted Selections
  bridge.onRequest("user-selection", async ()=>{
    heartbeat.heartBeat();
    const state = stateTracker.get();
    if(state.state !== "user-selection") throw new Error("Invalid State");
    const { encrypted } = await ownEncrypted;
    stateTracker.set({ state: "all-selection-for-user-decryption" });
    return encrypted;
  });
  // Handle All Selections
  // Return Decryption Key
  bridge.onRequest("all-selection-for-user-decryption", async (data)=>{
    heartbeat.heartBeat();
    const state = stateTracker.get();
    if(state.state !== "all-selection-for-user-decryption") throw new Error("Invalid State");
    const casted = EncryptedSelectionSchema.safeParse(data);
    if(!casted.success) throw new Error("Invalid Selections");
    if(Object.keys(casted.data).length !== users.length) throw new Error("Invalid User Count");
    for(const user of users){
      if(!casted.data[user.publicKey]) throw new Error("Missing User Selections");
    }
    const { key } = await ownEncrypted;
    stateTracker.set({ state: "all-decryption-for-user-final", encrypted: casted.data });
    console.log("roomInfo", data);
    return key;
  })
  // Handle All Decryption Keys
  // Return Final Selections
  bridge.onRequest("all-decryption-for-user-final", async (data)=>{
    heartbeat.heartBeat();
    const state = stateTracker.get();
    if(state.state !== "all-decryption-for-user-final") throw new Error("Invalid State");
    const allEncrypted = state.encrypted;
    const casted = DecryptionKeySchema.safeParse(data);
    if(!casted.success) throw new Error("Invalid Decryption Keys");
    if(Object.keys(casted.data).length !== users.length) throw new Error("Invalid User Count");
    const keys = casted.data;
    const decryptedSelections: Record<UserPublicKey, UserInput> = {}
    await Promise.all(users.map(async (user)=>{
      const encrypted = allEncrypted[user.publicKey];
      if(!encrypted) throw new Error("Missing Encrypted Selections");
      const key = keys[user.publicKey];
      if(!key) throw new Error("Missing Decryption Key");
      const decrypted = await decryptJSON(key, encrypted);
      const casted = SelectionSchema.safeParse(decrypted);
      if(!casted.success) throw new Error("Invalid Selections");
      decryptedSelections[user.publicKey] = casted.data;
    }))
    const finalSelection = await runSelection(
      lockConfig, scriptsByPath, gameControlledSelections, decryptedSelections, runUntrustedScript
    );
    stateTracker.set({ state: "user-download", finalSelection: finalSelection });

    console.log("roomInfo", data);
    return finalSelection;
  })

  bridge.onRequest("user-download", async ()=>{
    heartbeat.heartBeat();
    const state = stateTracker.get();
    if(state.state !== "user-download") throw new Error("Invalid State");
    const downloadResults = await handleDownloads(
      fileDB, lockConfig, state.finalSelection, {
        onProgress: (event)=>{bridge.sendEvent("download-progress", event)},
        abortSignal: downloadAbort.signal,
      }
    );
    stateTracker.set({ state: "all-download", finalSelection: state.finalSelection, downloadResults });
    return "ok"
  })

  bridge.onEvent("download-progress", (data: RosterLockDownloadUpdate)=>{
    heartbeat.heartBeat();
    progressListeners.onDownloadProgress?.(data);
  })

  bridge.onEvent("all-download", (data)=>{
    heartbeat.heartBeat();
    const state = stateTracker.get();
    if(state.state !== "all-download") throw new Error("Invalid State");
    resolve({
      finalSelection: state.finalSelection,
      downloadResults: state.downloadResults,
    });
  })

  bridge.onEvent("error", (error)=>{
    console.error("room error", error);
    downloadAbort.abort();
    reject(error);
  })

  promise.finally(()=>{
    heartbeat.stop();
    stateTracker.set({ state: "ended" });
  });

  return Promise.race([
    promise,
    heartbeat.promise.then(()=>{
      bridge.sendEvent("error", "Heartbeat Timeout");
      downloadAbort.abort();
      throw new Error("Heartbeat Timeout")
    })
  ]);
}

const EncryptedSelectionSchema: ZodType<Record<UserPublicKey, EncryptedValue["encrypted"]>> = z.record(z.string(), z.object({
  iv: z.string(),
  ciphertext: z.string(),
}));

const DecryptionKeySchema: ZodType<Record<UserPublicKey, EncryptedValue["key"]>> = z.record(z.string(), z.string());

const SelectionSchema: ZodType<UserInput> = z.object({
  userSelection: UserSelectionSchema,
  randomSeed: z.string(),
});


function trackHeartbeat(maxTimeout: number){
  const { resolve, promise } = Promise.withResolvers<void>();
  let to = setTimeout(resolve, maxTimeout);

  return {
    promise,
    heartBeat: ()=>{
      clearTimeout(to);
      to = setTimeout(resolve, maxTimeout);
    },
    stop: ()=>{
      clearTimeout(to);
    }
  }
}

class StateTracker {
  constructor(
    private state: RoomState,
    private listeners: ProgressListeners,
  ){}
  set(newState: RoomState){
    this.state = newState;
    this.listeners.onState?.(newState.state);
  }
  get(){
    return this.state;
  }
}