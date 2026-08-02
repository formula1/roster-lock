
import { PlayerId, PieceType, PieceId, Sha256 } from "../../shared";
import { SelectedPiece } from "../shared";

export * from "./download-event";

export type SharedSelection = {
  type: "shared",
  value: Array<SelectedPiece>,
};
export type PersonalSelection = {
  type: "personal",
  value: Record<PlayerId, Array<SelectedPiece>>,
};

export type FinalSelection = Record<PieceType, (
  | SharedSelection
  | PersonalSelection
)>;

export type DownloadResult = {
  pieceType: PieceType,
  pieceId: PieceId,
  pieceVersions: { logic: string, media: string },
  folder: string,
  mediaOverrides?: Array<{ hash: Sha256, folder: string }>,
}

export type DownloadResultsMap = Record<PieceType, Record<PieceId, DownloadResult>>;

export type RosterLockV1SyncDLResult = {
  finalSelection: FinalSelection,
  downloadResults: DownloadResultsMap,
}

