
import { MessageBridge } from "@roster-lock/utils";
import {
  FinalSelection, RosterLockV1Config, SelectedPiece, UserSelection, PlayerId,
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

type MachinePublicKey = string;

type EncryptedValue = Awaited<ReturnType<typeof encryptJSON>>;

type RoomState = (
  | { state: "user-selection" }
  | { state: "all-selection-for-user-decryption" }
  | { state: "all-decryption-for-user-final", encrypted: Record<MachinePublicKey, EncryptedValue["encryptedValue"]> }
  | { state: "user-download", finalSelection: FinalSelection }
  | { state: "all-download", finalSelection: FinalSelection, downloadResults: Awaited<ReturnType<typeof handleDownloads>> }
  | { state: "ended" }
)

type RoomArgs = {
  bridge: MessageBridge,
  fileDB: IFolderDB,
  pluginRuntime: PluginManager,
  machines: Array<{ publicKey: MachinePublicKey, playerCount: number }>,
  ownMachinePublicKey: MachinePublicKey,
  // This machine's local players' selections, keyed by local player index
  // (0-based). A machine with multiple controllers plugged in submits one
  // entry per local player over its single relay connection.
  ownSelections: Record<number, UserSelection>,
  lockConfig: RosterLockV1Config,
  gameControlledSelections: Record<string, Array<SelectedPiece> | Record<PlayerId, Array<SelectedPiece>>>,
}

export type ProgressListeners = Partial<{
  onState: (state: string)=>void,
  onDownloadProgress: (update: RosterLockDownloadUpdate)=>void,
}>

type UserInput = {
  userSelection: UserSelection,
  randomSeed: string,
}

// What one machine actually sends over the wire: all of its local players'
// selections plus the one random seed it contributes to the room.
type MachinePayload = {
  selections: Record<number, UserSelection>,
  randomSeed: string,
}

export function bindStepsToBridge(
  {
    bridge,
    fileDB,
    pluginRuntime,
    machines,
    ownMachinePublicKey,
    ownSelections,
    lockConfig,
    gameControlledSelections,
  }: RoomArgs,
  progressListeners: ProgressListeners = {}
): Promise<RosterLockV1SyncDLResult>{
  const { resolve, reject, promise } = Promise.withResolvers<RosterLockV1SyncDLResult>();
  const downloadAbort = new AbortController();
  const heartbeat = trackHeartbeat(30_000);
  const stateTracker = new StateTracker({ state: "user-selection" }, progressListeners);

  const rngSeed = createRandomSeed();
  const ownEncrypted = encryptJSON({ selections: ownSelections, randomSeed: rngSeed });
  // Filled in by "all-decryption-for-user-final" below, read back by the
  // handleFullSelection hook once the whole room promise settles.
  let decryptedSelections: Record<PlayerId, UserInput> = {};

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
    if(Object.keys(casted.data).length !== machines.length) throw new Error("Invalid Machine Count");
    for(const machine of machines){
      if(!casted.data[machine.publicKey]) throw new Error("Missing Machine Selections");
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
    if(Object.keys(casted.data).length !== machines.length) throw new Error("Invalid Machine Count");
    const keys = casted.data;
    await Promise.all(machines.map(async (machine)=>{
      const encrypted = allEncrypted[machine.publicKey];
      if(!encrypted) throw new Error("Missing Encrypted Selections");
      const key = keys[machine.publicKey];
      if(!key) throw new Error("Missing Decryption Key");
      const decrypted = await decryptJSON(key, encrypted);
      const casted = MachinePayloadSchema.safeParse(decrypted);
      if(!casted.success) throw new Error("Invalid Selections");
      const { selections, randomSeed } = casted.data;
      // A machine can't submit more or fewer player selections than it
      // declared to the matchmaker when the room was created.
      if(Object.keys(selections).length !== machine.playerCount){
        throw new Error("Player Count Mismatch");
      }
      for(const [index, userSelection] of Object.entries(selections)){
        decryptedSelections[`${machine.publicKey}:${index}`] = { userSelection, randomSeed };
      }
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
      Object.entries(decryptedSelections).map(([playerId, input])=>[playerId, input.userSelection])
    );
    const localPlayers = Object.keys(ownSelections).map((index)=>`${ownMachinePublicKey}:${index}`);
    return pluginRuntime.pieceSort.handleFullSelection({ lockConfig, localUsers: localPlayers, userSelections });
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

const EncryptedSelectionSchema: ZodType<Record<MachinePublicKey, EncryptedValue["encryptedValue"]>> = z.record(z.string(), z.string());

const DecryptionKeySchema: ZodType<Record<MachinePublicKey, string>> = z.record(z.string(), z.string());

const MachinePayloadSchema: ZodType<MachinePayload> = z.object({
  selections: z.record(z.string(), UserSelectionSchema),
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