import { RosterLockPiece, RosterLockV1Config } from "@roster-lock/types";
import { ProgressHandlers } from "../../handleDownloads/types";
import { Readable } from "node:stream";

export interface IFolderDB {
  ensurePieceExists(
    lockConfig: RosterLockV1Config["engine"],
    pieceType: string,
    selectedPiece: RosterLockPiece,
    progressHandlers: ProgressHandlers,
  ): Promise<string>,
  getFilesofAsset(
    engineConfig: RosterLockV1Config["engine"],
    pieceType: string,
    selectedPiece: Pick<RosterLockPiece, "version" | "pathVariables">,
    assetName: string
  ): AsyncIterable<string>
  getPieceFileContents(
    engineConfig: RosterLockV1Config["engine"],
    pieceType: string,
    selectedPiece: Pick<RosterLockPiece, "version" | "pathVariables">,
    filePath: string
  ): Promise<Readable>
  listPieces(
    engineName: string,
    pieceType: string,
    logicIds: Array<string>,
    pagination: { page: number, limit: number, }
  ): Promise<Array<Pick<RosterLockPiece, "version" | "pathVariables">>>
}

