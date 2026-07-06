import { RosterLockPiece, RosterLockV1Config } from "@roster-lock/types";
import { ProgressHandlers } from "../../handleDownloads/types";

export interface IFolderDB {
  ensurePieceExists(
    lockConfig: RosterLockV1Config,
    pieceType: string,
    selectedPiece: RosterLockPiece,
    progressHandlers: ProgressHandlers,
  ): Promise<string>
}
