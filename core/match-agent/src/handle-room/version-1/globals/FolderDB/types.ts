import { RosterLockPiece, RosterLockV1Config } from "@roster-lock/types";
import { ProgressHandlers } from "../../handleDownloads/types";
import { Readable } from "node:stream";

// A download source with the agent's latest test result for it. lastTest and
// success are null for sources that were declared but never attempted.
export type StoredDownloadSource = {
  source: string,
  // ms since epoch
  lastTest: number | null,
  success: boolean | null,
  error?: string,
};

// A downloaded piece as the agent stores it - identified by engine, piece
// type, and version hashes rather than a config-assigned id. downloadSources
// carries per-source test state on top of the config-declared list.
export type StoredPiece = (
  & Pick<RosterLockPiece, "version" | "humanInfo" | "pathVariables">
  & {
    engineName: string,
    pieceType: string,
    downloadSources: Array<StoredDownloadSource>,
  }
);

// A downloaded piece as the config editor browses it.
export type StoredPieceListing = {
  total: number,
  items: Array<{
    piece: StoredPiece,
    // ms since epoch; null for rows that predate completion tracking
    completedAt: number | null,
  }>,
};

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
  // Resolves a completed download's real on-disk folder - throws the same
  // 404 ("doesn't exist")/409 ("not finished") HTTPErrors as getFilesofAsset/
  // getPieceFileContents rather than returning undefined, so callers use the
  // same try/catch shape for all three.
  getPieceFolder(
    engineConfig: RosterLockV1Config["engine"],
    pieceType: string,
    selectedPiece: Pick<RosterLockPiece, "version" | "pathVariables">,
  ): Promise<string>
  listPieces(
    engineName: string,
    pieceType: string,
    logicIds: Array<string>,
    pagination: { page: number, limit: number, }
  ): Promise<Array<Pick<RosterLockPiece, "version" | "pathVariables">>>
  // Paginated browsing of every completed download - backs the config
  // editor's "add a piece you've already downloaded" flow.
  searchPieces(query: {
    engineName: string,
    pieceType?: string,
    search?: string,
    page: number,
    limit: number,
  }): Promise<StoredPieceListing>
}

