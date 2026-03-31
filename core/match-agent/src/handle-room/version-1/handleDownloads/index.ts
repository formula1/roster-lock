import { FinalSelection, RosterLockV1Config } from "@match-lock/shared";

import { PieceDownloadTracker, ResultsMap } from "./DownloadTracker";
import { MATCHLOCK_DOWNLOAD_STATE } from "../constants";
import { IFolderDB } from "../globals/FolderDB";
import { ProgressHandlers } from "./types";

export async function handleDownloads(
  db: IFolderDB,
  lockConfig: RosterLockV1Config,
  finalSelection: FinalSelection,
  progressHandlers: ProgressHandlers,
): Promise<ResultsMap> {
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
    progressHandlers.onProgress({ type: MATCHLOCK_DOWNLOAD_STATE.downloadAllComplete });
    return PieceDownloadTracker.resultsToMap(results);
  }catch(e){
    progressHandlers.onProgress({
      type: MATCHLOCK_DOWNLOAD_STATE.downloadFullFailure,
      error: (e as Error).message,
    });
    throw e;
  }
}

