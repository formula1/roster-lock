import { RosterLockV1Config, UserInput } from "@match-lock/shared";

import { Room } from "../../types/room";
import { waitForExternalError, waitForStoppedRoomHeartbeat } from "./roomErrors";
import { handleRoomSelections } from "./handleRoomSelections";
import { ExternalUserError, MATCHLOCK_SELECTION_STATE } from "./constants";
import { IFolderDB } from "./globals/FolderDB";
import { handleDownloads } from "./handleDownloads";

type Results = Awaited<ReturnType<typeof doWork>>;

export async function handleRoomVersion1(
  folderDB: IFolderDB,
  room: Room,
  lockConfig: RosterLockV1Config,
  selection: UserInput["userSelection"],
): Promise<Results>{
  const abortController = new AbortController();
  try {
    return await Promise.race([
      doWork(folderDB, room, abortController.signal, lockConfig, selection),
      waitForExternalError<Results>(room, abortController.signal),
      waitForStoppedRoomHeartbeat<Results>(room, 10_000, abortController.signal),
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

async function doWork(
  db: IFolderDB,
  room: Room,
  abortSignal: AbortSignal,
  lockConfig: RosterLockV1Config,
  userSelection: UserInput["userSelection"],
){
  const finalSelection = await handleRoomSelections(room, abortSignal, lockConfig, userSelection);
  const downloadResults = await handleDownloads(
    db, lockConfig, finalSelection, {
      onProgress: (event)=>{room.broadcast(event.type, event)},
      abortSignal
    }
  );
  return {
    finalSelection,
    downloadResults
  };
}
