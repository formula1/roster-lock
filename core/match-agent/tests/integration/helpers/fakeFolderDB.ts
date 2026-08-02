import { Readable } from "node:stream";
import { RosterLockV1Config, RosterLockPiece } from "@roster-lock/types";
import { IFolderDB } from "../../../src/handle-room/version-1/globals/FolderDB";
import { ProgressHandlers } from "../../../src/handle-room/version-1/handleDownloads/types";

// handleDownloads/DownloadTracker's job is orchestration (required-piece
// recursion, dedup, results-map building) - the actual file transfer is
// @roster-lock/plugin-runtime's concern. This fake resolves instantly and
// just records what it was asked to fetch, so tests can assert on the
// orchestration without a real download source.
export class FakeFolderDB implements IFolderDB {
  public calls: Array<{ pieceType: string, pieceId: string }> = [];
  public mediaOverrideCalls: Array<{ pieceType: string, logicHash: string, overrideHash: string }> = [];

  async ensurePieceExists(
    _lockConfig: RosterLockV1Config["engine"],
    pieceType: string,
    selectedPiece: RosterLockPiece,
    _progressHandlers: ProgressHandlers,
  ): Promise<string> {
    this.calls.push({ pieceType, pieceId: selectedPiece.id });
    return `/fake/${pieceType}/${selectedPiece.id}`;
  }

  async *getFilesofAsset(): AsyncIterable<string> {}

  async getPieceFileContents(): ReturnType<IFolderDB["getPieceFileContents"]> {
    throw new Error("not implemented in FakeFolderDB");
  }

  async ensureMediaOverrideExists(
    _lockConfig: RosterLockV1Config["engine"],
    pieceType: string,
    logicHash: string,
    overrideHash: string,
  ): ReturnType<IFolderDB["ensureMediaOverrideExists"]> {
    this.mediaOverrideCalls.push({ pieceType, logicHash, overrideHash });
    return `/fake/${pieceType}/media-overrides/${overrideHash}`;
  }

  async *getMediaOverrideFilesOfAsset(): AsyncIterable<string> {}

  async getMediaOverrideFileContents(): ReturnType<IFolderDB["getMediaOverrideFileContents"]> {
    throw new Error("not implemented in FakeFolderDB");
  }

  async listPieces(): ReturnType<IFolderDB["listPieces"]> {
    throw new Error("not implemented in FakeFolderDB");
  }

  async searchPieces(): ReturnType<IFolderDB["searchPieces"]>{
    throw new Error("not implemented in FakeFolderDB");
  }
}
