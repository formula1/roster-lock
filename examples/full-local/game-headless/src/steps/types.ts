import { KeyPair } from "../utils/crypto";

export type CurrentUser = {
  userId: string;
  displayName: string;
  keys: KeyPair;
}

export type RelayRoomConfig = {
  roomId: string;
  relayUrl: string;
}


import { PieceType, PieceId, UserId } from "@match-lock/shared";
type DownloadResult = {
  pieceType: PieceType,
  pieceId: PieceId,
  pieceVersions: { logic: string, media: string },
  folder: string,
}

type ResultsMap = Record<PieceType, Record<PieceId, DownloadResult>>;


type SelectedPiece = {
  id: PieceId,
  // selected: "selected" | "required",
  required: Record<PieceType, Array<SelectedPiece>>,
}
type FinalSelection = Record<PieceType, (
  | { type: "shared", value: Array<SelectedPiece> } // Shared Selection
  | { type: "personal", value: Record<UserId, Array<SelectedPiece>> } // Personal Selection
)>;

export type GameResult = {
  finalSelection: FinalSelection,
  downloadResults: ResultsMap,
}
