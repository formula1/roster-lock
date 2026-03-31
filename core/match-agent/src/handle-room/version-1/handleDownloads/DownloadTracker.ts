import { PieceType, PieceId, RosterLockPiece } from "@match-lock/shared";
import { RosterLockV1Config, SelectedPiece } from "@match-lock/shared";
import { IFolderDB } from "../globals/FolderDB";
import { ProgressHandlers } from "./types";
import { MATCHLOCK_DOWNLOAD_STATE } from "../constants";

type DownloadResult = {
  pieceType: PieceType,
  pieceId: PieceId,
  pieceVersions: { logic: string, media: string },
  folder: string,
}

export type ResultsMap = Record<PieceType, Record<PieceId, DownloadResult>>;
export class PieceDownloadTracker {
  private pieceTypes = new Map<PieceId, Map<PieceType, Promise<DownloadResult>>>();

  constructor(
    public database: IFolderDB,
    public lockConfig: RosterLockV1Config,
    public progressHandlers: ProgressHandlers,
  ){}

  public tryToDownloadAndNested(pieceType: PieceType, piece: SelectedPiece){
    if(!this.isDownloadQueued(pieceType, piece.id)){
      this.addNewDownload(
        pieceType, piece.id,
        tryToDownloadAnySource(this.database, this.lockConfig, pieceType, piece, this.progressHandlers)
      );
    }
    // We don't skip required as different pieces may have different required pieces
    for(const [requiredPieceType, requiredPieces] of Object.entries(piece.required)){
      for(const requiredPiece of requiredPieces){
        this.tryToDownloadAndNested(requiredPieceType, requiredPiece);
      }
    }
  }

  private isDownloadQueued(pieceType: PieceType, pieceId: PieceId){
    const pieces = this.pieceTypes.get(pieceType);
    if(!pieces) return false;
    return pieces.has(pieceId);
  }
  addNewDownload(pieceType: PieceType, pieceId: PieceId, promise: Promise<DownloadResult>){
    if(!this.pieceTypes.has(pieceType)){
      this.pieceTypes.set(pieceType, new Map());
    }
    this.pieceTypes.get(pieceType)!.set(pieceId, promise);
  }
  getDownloadPromises(){
    return Array.from(this.pieceTypes.values()).flatMap(r=>Array.from(r.values()));
  }

  static resultsToMap(results: DownloadResult[]): ResultsMap{
    const typeMap: ResultsMap = {};
    for(const result of results){
      const pieceMap: ResultsMap[PieceType] = (()=>{
        const map = typeMap[result.pieceType];
        if(map) return map;
        const newMap = {};
        typeMap[result.pieceType] = newMap;
        return newMap;
      })();
      pieceMap[result.pieceId] = result;
    }
    return typeMap;
  }
  
}

async function tryToDownloadAnySource(
  db: IFolderDB,
  lockconfig: RosterLockV1Config,
  pieceType: string,
  selectedPiece: SelectedPiece,
  progressHandlers: ProgressHandlers
): Promise<DownloadResult>{
  const pieces = lockconfig.rosters[pieceType];
  if(!pieces){
    throw new Error(`Missing Roster for piece type ${pieceType}`);
  }
  const piece = pieces.find(p=>p.id === selectedPiece.id);
  if(!piece){
    throw new Error(`Missing Piece ${selectedPiece.id} for piece type ${pieceType}`);
  }

  const pieceVersions = { logic: piece.version.logic, media: piece.version.media };
  progressHandlers.onProgress({
    type: MATCHLOCK_DOWNLOAD_STATE.downloadStart,
    pieceType,
    pieceVersions,
  });
  const folder = await db.ensurePieceExists(
    lockconfig, pieceType, piece, progressHandlers
  );
  progressHandlers.onProgress({
    type: MATCHLOCK_DOWNLOAD_STATE.downloadFinished,
    pieceType,
    pieceVersions,
  });
  return { pieceType, pieceId: selectedPiece.id, pieceVersions, folder };
}
