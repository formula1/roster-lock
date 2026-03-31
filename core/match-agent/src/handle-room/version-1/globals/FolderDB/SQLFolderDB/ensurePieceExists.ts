import { IFolderDB } from "../types";
import { RosterLockV1Config } from "@match-lock/shared";

import { existsSync as fsExists } from "node:fs";
import { rm as fsRm, mkdir } from "node:fs/promises";
import { join as pathJoin, isAbsolute as isAbsolutePath } from "node:path";
import { ProgressHandlers } from "../../../handleDownloads/types";
import { MATCHLOCK_DOWNLOAD_STATE } from "../../../constants";

import { downloadToFolder } from "@roster-lock/node-services";
import { getDownloadSourceVersion } from "./getVersions";
import { prepareDatabase } from "./schema";
import { MultiAbortSignal, raceWithAbort } from "./MultiAbort";
import { ulid } from 'ulid';

type RosterLockPiece = RosterLockV1Config["rosters"][string][number];

type PieceInfo = {
  pieceType: string,
  logic: string, media: string,
  pathVariables: Record<string, string>
}

export class SQLite3FolderDB implements IFolderDB {
  private db: ReturnType<typeof prepareDatabase>;
  private activeDownloads = new Map<string, {
    multiSignal: MultiAbortSignal,
    result: Promise<string>
  }>();

  constructor(public folder: string){
    if(!isAbsolutePath(folder)){
      throw new Error("Folder must be an absolute path");
    }
    if(!fsExists(folder)){
      throw new Error("Folder does not exist");
    }
    
    this.db = prepareDatabase(pathJoin(folder, "rosterlock.sqlite3.db"));
  }

  public close(){
    this.db.close();
  }

  private pieceFolder(
    engine: RosterLockV1Config["engine"], pieceType: string, folderName: string
  ){
    return pathJoin(this.folder, engine.name, pieceType, folderName);
  }

  async ensurePieceExists(
    lockConfig: RosterLockV1Config,
    pieceType: string,
    selectedPiece: RosterLockPiece,
    progressHandlers: ProgressHandlers,
  ){
    const pieceInfo = {
      pieceType,
      logic: selectedPiece.version.logic,
      media: selectedPiece.version.media,
      pathVariables: selectedPiece.pathVariables,
    };
    // Check if already completed
    const item = this.db.getPiece(lockConfig, pieceInfo);
    if(item && item.status === "complete") return this.pieceFolder(
      lockConfig.engine, item.piece_type, item.folder_name
    );

    // Check if currently downloading
    const key = pieceToKey(lockConfig.engine, pieceInfo);
    const activePromise = this.activeDownloads.get(key);
    if(activePromise){
      activePromise.multiSignal.addSignal(progressHandlers);
      try {
        return await raceWithAbort(activePromise.result, progressHandlers.abortSignal);
      }catch(e){
        activePromise.multiSignal.removeSignal(progressHandlers);
        throw e;
      }
    }

    // Check if already exists but failed
    if(item && item.status === "pending"){
      this.db.resetPieceStatus(lockConfig, pieceInfo);
    }

    // Start a new download
    const multiSignal = new MultiAbortSignal([progressHandlers]);
    const promise = this.addNewPiece(lockConfig, pieceType, selectedPiece, multiSignal.abortSignal);
    this.activeDownloads.set(key, {
      multiSignal,
      result: promise,
    });
    promise.finally(()=>{
      multiSignal.clear();
      this.activeDownloads.delete(key);
    });
    try {
      return await raceWithAbort(promise, progressHandlers.abortSignal);
    }catch(e){
      multiSignal.removeSignal(progressHandlers);
      throw e;
    }
  }

  private async addNewPiece(
    lockConfig: RosterLockV1Config,
    pieceType: string,
    newPiece: RosterLockPiece,
    abortSignal: AbortSignal,
  ){
    const pieceInfo = {
      pieceType: pieceType,
      logic: newPiece.version.logic,
      media: newPiece.version.media,
      pathVariables: newPiece.pathVariables,
    };
    const { folderName }: { folderName: string } = await (async ()=>{
      const existsingItem = this.db.getPiece(lockConfig, pieceInfo);
      if(existsingItem){
        await fsRm(
          this.pieceFolder(lockConfig.engine, pieceType, existsingItem.folder_name),
          { recursive: true, force: true }
        );
        return { folderName: existsingItem.folder_name };
      }
      const pieceFolder = ulid().toLowerCase();
      this.db.insertNewPiece(lockConfig, pieceInfo, "", pieceFolder);
      return { folderName: pieceFolder };
    })();


    const fullPath = this.pieceFolder(lockConfig.engine, pieceType, folderName);
    for(const downloadLocation of newPiece.downloadSources){
      try {
        await mkdir(fullPath, { recursive: true });
        this.db.updateDownloadSource(lockConfig, pieceInfo, downloadLocation);
        await downloadToFolder(
          downloadLocation, fullPath, {
            onProgress: (progress) => {
              this.emitProgress(lockConfig, pieceInfo, {
                type: MATCHLOCK_DOWNLOAD_STATE.downloadProgress,
                pieceType: pieceType,
                pieceVersions: { logic: pieceInfo.logic, media: pieceInfo.media },
                progress,
              });
            },
            abortSignal,
          }
        );
        this.emitProgress(lockConfig, pieceInfo, {
          type: MATCHLOCK_DOWNLOAD_STATE.downloadValidation,
          pieceType: pieceInfo.pieceType,
          pieceVersions: { logic: pieceInfo.logic, media: pieceInfo.media },
        });
        const downloadedVersions = await getDownloadSourceVersion(
          downloadLocation, newPiece.pathVariables, lockConfig.engine.pieceDefinitions[pieceType]
        );
        if(downloadedVersions.logic !== pieceInfo.logic || downloadedVersions.media !== pieceInfo.media){
          throw new Error("Version Mismatch");
        }
        this.db.pieceSuccessfullyDownloaded(lockConfig, pieceInfo);
        return fullPath;
      }catch(e){
        this.db.pieceFailedToDownload(lockConfig, pieceInfo, downloadLocation, (e as Error).message);
        await fsRm(fullPath, { recursive: true, force: true });
        this.emitProgress(lockConfig, pieceInfo, {
          type: MATCHLOCK_DOWNLOAD_STATE.downloadFailure,
          pieceType,
          pieceVersions: { logic: pieceInfo.logic, media: pieceInfo.media },
          error: (e as Error).message,
        });
      }
    }
    throw new Error("Failed To Download");
  }


  private emitProgress(
    lockConfig: RosterLockV1Config,
    pieceInfo: PieceInfo,
    event: Parameters<ProgressHandlers["onProgress"]>[0]
  ){
    const key = pieceToKey(lockConfig.engine, pieceInfo);
    const multiSignal = this.activeDownloads.get(key)?.multiSignal;
    if(!multiSignal) return;
    multiSignal.emitEvent(event);
  }
}


function pieceToKey(engine: RosterLockV1Config["engine"], piece: PieceInfo){
  return `${engine.name}-${piece.pieceType}-${piece.logic}-${piece.media}`;
}
