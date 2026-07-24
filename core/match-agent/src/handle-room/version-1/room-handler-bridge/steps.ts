
import { MessageBridge } from "@roster-lock/utils";
import {
  FinalSelection, RosterLockV1Config, SelectedPiece, UserSelection,
  RosterLockV1SyncDLResult
} from "@roster-lock/types";
import { runSelection } from "@roster-lock/shared";
import { encryptJSON, decryptJSON } from "../handleRoomSelections/encryption";
import { createRandomSeed } from "../handleRoomSelections/random";
import { z, ZodType } from "zod";
import { UserSelectionSchema } from "../schema/selected";
import { PluginManager } from "@roster-lock/plugin-runtime";
import { handleDownloads } from "../handleDownloads";
import { IFolderDB } from "../globals/FolderDB";
import { RosterLockDownloadUpdate } from "@roster-lock/types";

type UserPublicKey = string;

type EncryptedValue = Awaited<ReturnType<typeof encryptJSON>>;

type RoomState = (
  | { state: "user-selection" }
  | { state: "all-selection-for-user-decryption" }
  | { state: "all-decryption-for-user-final", encrypted: Record<UserPublicKey, EncryptedValue["encryptedValue"]> }
  | { state: "user-download", finalSelection: FinalSelection }
  | { state: "all-download", finalSelection: FinalSelection, downloadResults: Awaited<ReturnType<typeof handleDownloads>> }
  | { state: "ended" }
)

type RoomArgs = {
  bridge: MessageBridge,
  fileDB: IFolderDB,
  pluginRuntime: PluginManager,
  users: Array<{ publicKey: UserPublicKey }>,
  ownSelection: UserSelection,
  lockConfig: RosterLockV1Config,
  gameControlledSelections: Record<string, Array<SelectedPiece> | Record<UserPublicKey, Array<SelectedPiece>>>,
  // The user(s) local to this match-agent instance driving this room (as opposed
  // to the other players in `users`, whose selections we only see encrypted/merged).
  // Expected to grow past one entry once local multiplayer lands.
  localUsers: Array<UserPublicKey>,
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
    pluginRuntime,
    users,
    ownSelection,
    lockConfig,
    gameControlledSelections,
    localUsers,
  }: RoomArgs,
  progressListeners: ProgressListeners = {}
): Promise<RosterLockV1SyncDLResult>{
  const { resolve, reject, promise } = Promise.withResolvers<RosterLockV1SyncDLResult>();
  const downloadAbort = new AbortController();
  const heartbeat = trackHeartbeat(30_000);
  const stateTracker = new StateTracker({ state: "user-selection" }, progressListeners);

  const rngSeed = createRandomSeed();
  const ownEncrypted = encryptJSON({ userSelection: ownSelection, randomSeed: rngSeed });
  // Filled in by "all-decryption-for-user-final" below, read back by the
  // handleFullSelection hook once the whole room promise settles.
  let decryptedSelections: Record<UserPublicKey, UserInput> = {};

  bridge.onRequest("ping", ()=>{
    heartbeat.heartBeat();
    return "pong";
  });

  // Return Encrypted Selections
  bridge.onRequest("user-selection", async ()=>{
    heartbeat.heartBeat();
    const state = stateTracker.get();
    if(state.state !== "user-selection") throw new Error("Invalid State");
    const { encryptedValue } = await ownEncrypted;
    stateTracker.set({ state: "all-selection-for-user-decryption" });
    return encryptedValue;
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
      lockConfig, gameControlledSelections, decryptedSelections, (script)=>(pluginRuntime.runUntrustedScript(script))
    );
    stateTracker.set({ state: "user-download", finalSelection: finalSelection });

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

  // .finally()'s returned promise mirrors promise's rejection - it has to
  // be observed here too, or a failed room leaves an unhandled rejection.
  promise.finally(()=>{
    heartbeat.stop();
    stateTracker.set({ state: "ended" });
  }).catch(()=>{});

  // Only fires once the whole room succeeds (selection + downloads) - doesn't
  // block "all-decryption-for-user-final"'s response, and a broken/misbehaving
  // indexing plugin can't stop the room, so failures here are only logged.
  promise.then(()=>{
    const userSelections = Object.fromEntries(
      Object.entries(decryptedSelections).map(([userId, input])=>[userId, input.userSelection])
    );
    return pluginRuntime.pieceSort.handleFullSelection({ lockConfig, localUsers, userSelections });
  }).catch((e)=>{
    console.error("piece-selection-sort handleFullSelection failed", e);
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

const EncryptedSelectionSchema: ZodType<Record<UserPublicKey, EncryptedValue["encryptedValue"]>> = z.record(z.string(), z.string());

const DecryptionKeySchema: ZodType<Record<UserPublicKey, string>> = z.record(z.string(), z.string());

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