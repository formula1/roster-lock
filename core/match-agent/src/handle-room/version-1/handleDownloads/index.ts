import { FinalSelection, RosterLockV1Config } from "@roster-lock/types";

import { PieceDownloadTracker } from "./DownloadTracker";
import { ROSTERLOCK_DOWNLOAD_STATE } from "@roster-lock/types";
import { IFolderDB } from "../globals/FolderDB";
import { ProgressHandlers, DownloadResultsMap } from "./types";

export async function handleDownloads(
  db: IFolderDB,
  lockConfig: RosterLockV1Config,
  finalSelection: FinalSelection,
  progressHandlers: ProgressHandlers,
): Promise<DownloadResultsMap> {
  try {
    const downloadTracker = new PieceDownloadTracker(db, lockConfig, progressHandlers);
    for(const [pieceType, selection] of Object.entries(finalSelection)){
      if(selection.type === "shared"){
        for(const piece of selection.value){
          downloadTracker.tryToDownloadAndNested(pieceType, piece);
        }
      }
      if(selection.type === "personal"){
        for(const pieces of Object.values(selection.value)){
          for(const piece of pieces){
            downloadTracker.tryToDownloadAndNested(pieceType, piece);
          }
        }
      }
    }
    const results = await Promise.all(downloadTracker.getDownloadPromises());
    progressHandlers.onProgress({ type: ROSTERLOCK_DOWNLOAD_STATE.downloadAllComplete });
    return PieceDownloadTracker.resultsToMap(results);
  }catch(e){
    progressHandlers.onProgress({
      type: ROSTERLOCK_DOWNLOAD_STATE.downloadFullFailure,
      error: (e as Error).message,
    });
    throw e;
  }
}

