import { IFolderDB, StoredPieceListing } from "../types";
import { RosterLockV1Config, MediaOverrideEntry, ROSTERLOCK_DOWNLOAD_STATE } from "@roster-lock/types";

import { existsSync as fsExists, createReadStream } from "node:fs";
import { rm as fsRm } from "node:fs/promises";
import { join as pathJoin, isAbsolute as isAbsolutePath, relative as pathRelative } from "node:path";
import { ProgressHandlers } from "../../../handleDownloads/types";

import { PluginManager } from "@roster-lock/plugin-runtime";
import { getDownloadSourceVersion, getMediaOverrideDownloadSourceVersion } from "./getVersions";
import { prepareDatabase } from "./schema";
import { DownloadCoordinator, downloadWithFallbackSources } from "./downloadHelpers";
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

type MediaOverrideIndex = {
  engineName: string,
  pieceType: string,
  logicHash: string,
  overrideHash: string,
}

export class SQLite3FolderDB implements IFolderDB {
  private db: ReturnType<typeof prepareDatabase>;
  private pieceDownloads = new DownloadCoordinator<string>();
  private mediaOverrideDownloads = new DownloadCoordinator<string>();

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

  private mediaOverrideFolder(
    engine: RosterLockV1Config["engine"], pieceType: string, folderName: string
  ){
    return pathJoin(this.folder, engine.name, pieceType, "media-overrides", folderName);
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
    return this.readFileInFolder(folder, filePath);
  }

  async* getMediaOverrideFilesOfAsset(
    engineConfig: RosterLockV1Config["engine"],
    pieceType: string,
    logicHash: string,
    overrideHash: string,
    pathVariables: Record<string, string>,
    assetName: string
  ): AsyncIterable<string>{
    const index = { engineName: engineConfig.name, pieceType, logicHash, overrideHash };
    const state = this.db.getMediaOverrideState(index);
    if(!state) throw new HTTPError(404, "Media override doesn't exist");
    if(state.status !== "complete")
      throw new HTTPError(409, "Media override not finished");
    const folder = this.mediaOverrideFolder(engineConfig, pieceType, state.folderName);
    for await (const path of getFilesFromFolder(folder)){
      const assets = getMatchingAssetsForFile(
        engineConfig.pieceDefinitions[pieceType],
        pathVariables,
        path
      );
      if(assets[0]?.name === assetName)
        yield path;
    }
  }

  async getMediaOverrideFileContents(
    engineConfig: RosterLockV1Config["engine"],
    pieceType: string,
    logicHash: string,
    overrideHash: string,
    filePath: string
  ): Promise<Readable> {
    const index = { engineName: engineConfig.name, pieceType, logicHash, overrideHash };
    const state = this.db.getMediaOverrideState(index);
    if(!state) throw new HTTPError(404, "Media override doesn't exist");
    if(state.status !== "complete")
      throw new HTTPError(409, "Media override not finished");
    const folder = this.mediaOverrideFolder(engineConfig, pieceType, state.folderName);
    return this.readFileInFolder(folder, filePath);
  }

  private readFileInFolder(folder: string, filePath: string): Readable {
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
    const state = this.db.getPieceState(pieceIndex);
    if(state && state.status === "complete") return this.pieceFolder(
      lockConfigEngine, pieceType, state.folderName
    );

    const key = pieceToKey(pieceIndex);
    return this.pieceDownloads.run(key, progressHandlers, (abortSignal)=>(
      this.addNewPiece(lockConfigEngine, pieceType, selectedPiece, abortSignal, key)
    ));
  }

  private async addNewPiece(
    lockConfigEngine: RosterLockV1Config["engine"],
    pieceType: string,
    newPiece: RosterLockPiece,
    abortSignal: AbortSignal,
    coordinatorKey: string,
  ){
    const pieceIndex = pieceIndexOf(lockConfigEngine, pieceType, newPiece);
    const existingState = this.db.getPieceState(pieceIndex);
    if(existingState) this.db.resetPieceStatus(pieceIndex);
    const { folderName }: { folderName: string } = await (async ()=>{
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
    await downloadWithFallbackSources({
      downloadSources: newPiece.downloadSources,
      destinationFolder: fullPath,
      abortSignal,
      pluginRuntime: this.pluginRuntime,
      onProgress: (progress) => this.pieceDownloads.emitProgress(coordinatorKey, {
        type: ROSTERLOCK_DOWNLOAD_STATE.downloadProgress,
        pieceType,
        pieceVersions: { logic: pieceIndex.logic, media: pieceIndex.media },
        progress,
      }),
      onValidating: () => this.pieceDownloads.emitProgress(coordinatorKey, {
        type: ROSTERLOCK_DOWNLOAD_STATE.downloadValidation,
        pieceType,
        pieceVersions: { logic: pieceIndex.logic, media: pieceIndex.media },
      }),
      verify: (folder) => getDownloadSourceVersion(
        folder, newPiece.pathVariables, lockConfigEngine.pieceDefinitions[pieceType]
      ),
      versionsMatch: (actual) => (
        actual.logic === pieceIndex.logic && actual.media === pieceIndex.media
      ),
      onSourceSuccess: (source) => this.db.pieceSuccessfullyDownloaded(pieceIndex, source),
      onSourceFailure: (source, message) => {
        this.db.pieceFailedToDownload(pieceIndex, source, message);
        this.pieceDownloads.emitProgress(coordinatorKey, {
          type: ROSTERLOCK_DOWNLOAD_STATE.downloadFailure,
          pieceType,
          pieceVersions: { logic: pieceIndex.logic, media: pieceIndex.media },
          error: message,
        });
      },
    });
    return fullPath;
  }

  async ensureMediaOverrideExists(
    lockConfigEngine: RosterLockV1Config["engine"],
    pieceType: string,
    logicHash: string,
    overrideHash: string,
    entry: MediaOverrideEntry,
    pathVariables: Record<string, string>,
    progressHandlers: ProgressHandlers,
  ){
    const index: MediaOverrideIndex = { engineName: lockConfigEngine.name, pieceType, logicHash, overrideHash };
    const state = this.db.getMediaOverrideState(index);
    if(state && state.status === "complete") return this.mediaOverrideFolder(
      lockConfigEngine, pieceType, state.folderName
    );

    const key = mediaOverrideToKey(index);
    return this.mediaOverrideDownloads.run(key, progressHandlers, (abortSignal)=>(
      this.addNewMediaOverride(lockConfigEngine, pieceType, entry, pathVariables, index, abortSignal, key)
    ));
  }

  private async addNewMediaOverride(
    lockConfigEngine: RosterLockV1Config["engine"],
    pieceType: string,
    entry: MediaOverrideEntry,
    pathVariables: Record<string, string>,
    index: MediaOverrideIndex,
    abortSignal: AbortSignal,
    coordinatorKey: string,
  ){
    const existingState = this.db.getMediaOverrideState(index);
    if(existingState) this.db.resetMediaOverrideStatus(index);
    const { folderName }: { folderName: string } = await (async ()=>{
      if(existingState){
        await fsRm(
          this.mediaOverrideFolder(lockConfigEngine, pieceType, existingState.folderName),
          { recursive: true, force: true }
        );
        return { folderName: existingState.folderName };
      }
      const overrideFolder = ulid().toLowerCase();
      this.db.insertNewMediaOverride(
        { ...index, name: entry.name, assets: entry.assets, downloadSources: entry.downloadSources },
        overrideFolder
      );
      return { folderName: overrideFolder };
    })();

    const fullPath = this.mediaOverrideFolder(lockConfigEngine, pieceType, folderName);
    await downloadWithFallbackSources({
      downloadSources: entry.downloadSources,
      destinationFolder: fullPath,
      abortSignal,
      pluginRuntime: this.pluginRuntime,
      onProgress: (progress) => this.mediaOverrideDownloads.emitProgress(coordinatorKey, {
        type: ROSTERLOCK_DOWNLOAD_STATE.mediaOverrideDownloadProgress,
        pieceType,
        logic: index.logicHash,
        override: index.overrideHash,
        progress,
      }),
      onValidating: () => this.mediaOverrideDownloads.emitProgress(coordinatorKey, {
        type: ROSTERLOCK_DOWNLOAD_STATE.mediaOverrideDownloadValidation,
        pieceType,
        logic: index.logicHash,
        override: index.overrideHash,
      }),
      verify: (folder) => getMediaOverrideDownloadSourceVersion(
        folder, pathVariables, lockConfigEngine.pieceDefinitions[pieceType], entry.assets
      ),
      versionsMatch: (actual) => actual === index.overrideHash,
      onSourceSuccess: (source) => this.db.mediaOverrideSuccessfullyDownloaded(index, source),
      onSourceFailure: (source, message) => {
        this.db.mediaOverrideFailedToDownload(index, source, message);
        this.mediaOverrideDownloads.emitProgress(coordinatorKey, {
          type: ROSTERLOCK_DOWNLOAD_STATE.mediaOverrideDownloadFailure,
          pieceType,
          logic: index.logicHash,
          override: index.overrideHash,
          error: message,
        });
      },
    });
    return fullPath;
  }
}


function pieceToKey(piece: PieceIndex){
  return `${piece.engineName}-${piece.pieceType}-${piece.logic}-${piece.media}`;
}

function mediaOverrideToKey(index: MediaOverrideIndex){
  return `${index.engineName}-${index.pieceType}-${index.logicHash}-${index.overrideHash}`;
}
