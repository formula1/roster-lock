import { IFolderDB } from "../types";
import { RosterLockV1Config, ROSTERLOCK_DOWNLOAD_STATE } from "@roster-lock/types";

import { existsSync as fsExists, createReadStream } from "node:fs";
import { rm as fsRm, mkdir } from "node:fs/promises";
import { join as pathJoin, isAbsolute as isAbsolutePath, relative as pathRelative } from "node:path";
import { ProgressHandlers } from "../../../handleDownloads/types";

import { downloadToFolder, DEFAULT_PLUGIN_DIR } from "@roster-lock/plugin-runtime";
import { getDownloadSourceVersion } from "./getVersions";
import { prepareDatabase } from "./schema";
import { MultiAbortSignal, raceWithAbort } from "./MultiAbort";
import { ulid } from 'ulid';
import { HTTPError } from "../../../../../utils/http-router";
import { getMatchingAssetsForFile } from "@roster-lock/shared";
import { getFilesFromFolder } from "../../../../../utils/fs";
import { Readable } from "node:stream";


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

  async listPieces(
    enginename: string,
    pieceType: string,
    logicIds: Array<string>,
    pagination: { page: number, limit: number }
  ){
    const pieces = this.db.listPieces(
      enginename,
      pieceType,
      logicIds,
      pagination,
    )
    return pieces.map((piece)=>(
      {
        version: { logic: piece.logic_hash, media: piece.media_hash, docs: "" },
        pathVariables: piece.path_variables,
      }
    ))
  }

  async* getFilesofAsset(
    engineConfig: RosterLockV1Config["engine"],
    pieceType: string,
    piece: Pick<RosterLockPiece, "version" | "pathVariables">,
    assetName: string
  ): AsyncIterable<string>{
    const pieceInfo = {
      pieceType: pieceType,
      logic: piece.version.logic,
      media: piece.version.media,
      pathVariables: piece.pathVariables,
    };
    const item = this.db.getPiece(engineConfig, pieceInfo);
    if(!item) throw new HTTPError(404, "Piece Doesn't exist");
    if(item.status !== "complete")
       throw new HTTPError(409, "Piece not finished");
    const folder = this.pieceFolder(
      engineConfig, item.piece_type, item.folder_name
    );
    for await (const path of getFilesFromFolder(folder)){
      const assets = getMatchingAssetsForFile(
        engineConfig.pieceDefinitions[pieceType],
        piece.pathVariables,
        path
      );
      if(assets[0]?.name === assetName)
        yield path;
    }
  }

  async getPieceFileContents(
    engineConfig: RosterLockV1Config["engine"],
    pieceType: string,
    piece: Pick<RosterLockPiece, "version" | "pathVariables">,
    filePath: string
  ): Promise<Readable> {
    const pieceInfo = {
      pieceType: pieceType,
      logic: piece.version.logic,
      media: piece.version.media,
      pathVariables: piece.pathVariables,
    };
    const item = this.db.getPiece(engineConfig, pieceInfo);
    if(!item) throw new HTTPError(404, "Piece doesn't exist");
    if(item.status !== "complete")
       throw new HTTPError(409, "Piece not finished");
    const folder = this.pieceFolder(
      engineConfig, item.piece_type, item.folder_name
    );
    const fullPath = pathJoin(folder, filePath);
    const rel = pathRelative(folder, fullPath)
    if(rel.startsWith("..") || isAbsolutePath(rel))
      throw new HTTPError(400, "Can't back out of folder");
    if(!fsExists(fullPath))
      throw new HTTPError(404, "File doesn't exist");
    return createReadStream(fullPath)
  }


  async ensurePieceExists(
    lockConfigEngine: RosterLockV1Config["engine"],
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
    const item = this.db.getPiece(lockConfigEngine, pieceInfo);
    if(item && item.status === "complete") return this.pieceFolder(
      lockConfigEngine, item.piece_type, item.folder_name
    );

    // Check if currently downloading
    const key = pieceToKey(lockConfigEngine, pieceInfo);
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
      this.db.resetPieceStatus(lockConfigEngine, pieceInfo);
    }

    // Start a new download
    const multiSignal = new MultiAbortSignal([progressHandlers]);
    const promise = this.addNewPiece(lockConfigEngine, pieceType, selectedPiece, multiSignal.abortSignal);
    this.activeDownloads.set(key, {
      multiSignal,
      result: promise,
    });
    // promise is already awaited below via raceWithAbort; catch here too so
    // this second attached continuation doesn't count as an unhandled
    // rejection (each .then/.finally chain is tracked independently by Node).
    promise.finally(()=>{
      multiSignal.clear();
      this.activeDownloads.delete(key);
    }).catch(()=>{});
    try {
      return await raceWithAbort(promise, progressHandlers.abortSignal);
    }catch(e){
      multiSignal.removeSignal(progressHandlers);
      throw e;
    }
  }

  private async addNewPiece(
    lockConfigEngine: RosterLockV1Config["engine"],
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
      const existsingItem = this.db.getPiece(lockConfigEngine, pieceInfo);
      if(existsingItem){
        await fsRm(
          this.pieceFolder(lockConfigEngine, pieceType, existsingItem.folder_name),
          { recursive: true, force: true }
        );
        return { folderName: existsingItem.folder_name };
      }
      const pieceFolder = ulid().toLowerCase();
      this.db.insertNewPiece(lockConfigEngine, pieceInfo, "", pieceFolder);
      return { folderName: pieceFolder };
    })();


    const fullPath = this.pieceFolder(lockConfigEngine, pieceType, folderName);
    for(const downloadLocation of newPiece.downloadSources){
      try {
        await mkdir(fullPath, { recursive: true });
        this.db.updateDownloadSource(lockConfigEngine, pieceInfo, downloadLocation);
        const { finishPromise } = await downloadToFolder(
          DEFAULT_PLUGIN_DIR, {
            url: downloadLocation,
            destinationFolder: fullPath,
            processHandlers: {
              onProgress: (progress) => {
                this.emitProgress(lockConfigEngine, pieceInfo, {
                  type: ROSTERLOCK_DOWNLOAD_STATE.downloadProgress,
                  pieceType: pieceType,
                  pieceVersions: { logic: pieceInfo.logic, media: pieceInfo.media },
                  progress,
                });
              },
              abortSignal,
            }
          }
        );
        await finishPromise;
        this.emitProgress(lockConfigEngine, pieceInfo, {
          type: ROSTERLOCK_DOWNLOAD_STATE.downloadValidation,
          pieceType: pieceInfo.pieceType,
          pieceVersions: { logic: pieceInfo.logic, media: pieceInfo.media },
        });
        const downloadedVersions = await getDownloadSourceVersion(
          fullPath, newPiece.pathVariables, lockConfigEngine.pieceDefinitions[pieceType]
        );
        if(downloadedVersions.logic !== pieceInfo.logic || downloadedVersions.media !== pieceInfo.media){
          throw new Error("Version Mismatch");
        }
        this.db.pieceSuccessfullyDownloaded(lockConfigEngine, pieceInfo);
        return fullPath;
      }catch(e){
        this.db.pieceFailedToDownload(lockConfigEngine, pieceInfo, downloadLocation, (e as Error).message);
        await fsRm(fullPath, { recursive: true, force: true });
        this.emitProgress(lockConfigEngine, pieceInfo, {
          type: ROSTERLOCK_DOWNLOAD_STATE.downloadFailure,
          pieceType,
          pieceVersions: { logic: pieceInfo.logic, media: pieceInfo.media },
          error: (e as Error).message,
        });
      }
    }
    throw new Error("Failed To Download");
  }


  private emitProgress(
    lockConfigEngine: RosterLockV1Config["engine"],
    pieceInfo: PieceInfo,
    event: Parameters<ProgressHandlers["onProgress"]>[0]
  ){
    const key = pieceToKey(lockConfigEngine, pieceInfo);
    const multiSignal = this.activeDownloads.get(key)?.multiSignal;
    if(!multiSignal) return;
    multiSignal.emitEvent(event);
  }
}


function pieceToKey(engine: RosterLockV1Config["engine"], piece: PieceInfo){
  return `${engine.name}-${piece.pieceType}-${piece.logic}-${piece.media}`;
}
