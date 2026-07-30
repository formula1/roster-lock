import { IFolderDB, StoredPieceListing } from "../types";
import { RosterLockV1Config, ROSTERLOCK_DOWNLOAD_STATE } from "@roster-lock/types";

import { existsSync as fsExists, createReadStream } from "node:fs";
import { rm as fsRm, mkdir } from "node:fs/promises";
import { join as pathJoin, isAbsolute as isAbsolutePath, relative as pathRelative } from "node:path";
import { ProgressHandlers } from "../../../handleDownloads/types";

import { PluginManager } from "@roster-lock/plugin-runtime";
import { getDownloadSourceVersion } from "./getVersions";
import { prepareDatabase } from "./schema";
import { MultiAbortSignal, raceWithAbort } from "./MultiAbort";
import { ulid } from 'ulid';
import { HTTPError } from "../../../../../utils/http-router";
import { getMatchingAssetsForFile } from "@roster-lock/shared";
import { getFilesFromFolder } from "../../../../../utils/fs";
import { Readable } from "node:stream";


type RosterLockPiece = RosterLockV1Config["rosters"][string][number];

type PieceIndex = {
  engineName: string,
  pieceType: string,
  logic: string,
  media: string,
}

function pieceIndexOf(
  engine: RosterLockV1Config["engine"],
  pieceType: string,
  piece: Pick<RosterLockPiece, "version">,
): PieceIndex {
  return {
    engineName: engine.name,
    pieceType,
    logic: piece.version.logic,
    media: piece.version.media,
  };
}

export class SQLite3FolderDB implements IFolderDB {
  private db: ReturnType<typeof prepareDatabase>;
  private activeDownloads = new Map<string, {
    multiSignal: MultiAbortSignal,
    result: Promise<string>
  }>();

  constructor(public folder: string, private pluginRuntime: PluginManager){
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
    return pieces
  }

  async searchPieces(
    query: {
      engineName: string,
      pieceType?: string,
      search?: string,
      page: number,
      limit: number,
    }
  ): Promise<StoredPieceListing> {
    const { total, items } = this.db.searchPieces(query);
    const pieceKeys = items.map((item)=>({
      pieceType: item.pieceType, logic: item.version.logic, media: item.version.media,
    }));
    const sourcesByPiece = this.db.getDownloadSourcesFor(query.engineName, pieceKeys);
    const statesByPiece = this.db.getPieceStatesFor(query.engineName, pieceKeys);
    return {
      total,
      items: items.map((item)=>{
        const key = `${item.pieceType}\x00${item.version.logic}\x00${item.version.media}`;
        const state = statesByPiece.get(key);
        return {
          piece: {
            ...item,
            downloadSources: (sourcesByPiece.get(key) ?? []).map((source)=>({
              source: source.source,
              lastTest: source.last_test === null ? null : source.last_test * 1000,
              success: source.success === null ? null : source.success === 1,
              ...(source.error === null ? {} : { error: source.error }),
            })),
          },
          completedAt: state?.completedAt ? state.completedAt * 1000 : null,
        };
      }),
    };
  }

  async* getFilesofAsset(
    engineConfig: RosterLockV1Config["engine"],
    pieceType: string,
    piece: Pick<RosterLockPiece, "version" | "pathVariables">,
    assetName: string
  ): AsyncIterable<string>{
    const state = this.db.getPieceState(pieceIndexOf(engineConfig, pieceType, piece));
    if(!state) throw new HTTPError(404, "Piece Doesn't exist");
    if(state.status !== "complete")
       throw new HTTPError(409, "Piece not finished");
    const folder = this.pieceFolder(
      engineConfig, pieceType, state.folderName
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
    const state = this.db.getPieceState(pieceIndexOf(engineConfig, pieceType, piece));
    if(!state) throw new HTTPError(404, "Piece doesn't exist");
    if(state.status !== "complete")
       throw new HTTPError(409, "Piece not finished");
    const folder = this.pieceFolder(
      engineConfig, pieceType, state.folderName
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
    const pieceIndex = pieceIndexOf(lockConfigEngine, pieceType, selectedPiece);
    // Check if already completed
    const state = this.db.getPieceState(pieceIndex);
    if(state && state.status === "complete") return this.pieceFolder(
      lockConfigEngine, pieceType, state.folderName
    );

    // Check if currently downloading
    const key = pieceToKey(pieceIndex);
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
    if(state && state.status === "pending"){
      this.db.resetPieceStatus(pieceIndex);
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
    const pieceIndex = pieceIndexOf(lockConfigEngine, pieceType, newPiece);
    const { folderName }: { folderName: string } = await (async ()=>{
      const existingState = this.db.getPieceState(pieceIndex);
      if(existingState){
        await fsRm(
          this.pieceFolder(lockConfigEngine, pieceType, existingState.folderName),
          { recursive: true, force: true }
        );
        return { folderName: existingState.folderName };
      }
      const pieceFolder = ulid().toLowerCase();
      this.db.insertNewPiece(
        {
          engineName: lockConfigEngine.name,
          pieceType,
          version: newPiece.version,
          humanInfo: newPiece.humanInfo,
          pathVariables: newPiece.pathVariables,
          downloadSources: newPiece.downloadSources,
        },
        pieceFolder
      );
      return { folderName: pieceFolder };
    })();


    const fullPath = this.pieceFolder(lockConfigEngine, pieceType, folderName);
    for(const downloadLocation of newPiece.downloadSources){
      try {
        await mkdir(fullPath, { recursive: true });
        const { finishPromise } = await this.pluginRuntime.downloadToFolder(
          {
            url: downloadLocation,
            destinationFolder: fullPath,
            processHandlers: {
              onProgress: (progress) => {
                this.emitProgress(pieceIndex, {
                  type: ROSTERLOCK_DOWNLOAD_STATE.downloadProgress,
                  pieceType: pieceType,
                  pieceVersions: { logic: pieceIndex.logic, media: pieceIndex.media },
                  progress,
                });
              },
              abortSignal,
            }
          }
        );
        await finishPromise;
        this.emitProgress(pieceIndex, {
          type: ROSTERLOCK_DOWNLOAD_STATE.downloadValidation,
          pieceType: pieceIndex.pieceType,
          pieceVersions: { logic: pieceIndex.logic, media: pieceIndex.media },
        });
        const downloadedVersions = await getDownloadSourceVersion(
          fullPath, newPiece.pathVariables, lockConfigEngine.pieceDefinitions[pieceType]
        );
        if(downloadedVersions.logic !== pieceIndex.logic || downloadedVersions.media !== pieceIndex.media){
          throw new Error("Version Mismatch");
        }
        this.db.pieceSuccessfullyDownloaded(pieceIndex, downloadLocation);
        return fullPath;
      }catch(e){
        this.db.pieceFailedToDownload(pieceIndex, downloadLocation, (e as Error).message);
        await fsRm(fullPath, { recursive: true, force: true });
        this.emitProgress(pieceIndex, {
          type: ROSTERLOCK_DOWNLOAD_STATE.downloadFailure,
          pieceType,
          pieceVersions: { logic: pieceIndex.logic, media: pieceIndex.media },
          error: (e as Error).message,
        });
      }
    }
    throw new Error("Failed To Download");
  }


  private emitProgress(
    pieceIndex: PieceIndex,
    event: Parameters<ProgressHandlers["onProgress"]>[0]
  ){
    const key = pieceToKey(pieceIndex);
    const multiSignal = this.activeDownloads.get(key)?.multiSignal;
    if(!multiSignal) return;
    multiSignal.emitEvent(event);
  }
}


function pieceToKey(piece: PieceIndex){
  return `${piece.engineName}-${piece.pieceType}-${piece.logic}-${piece.media}`;
}
