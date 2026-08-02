import { PieceId, PieceType, Sha256 } from "../shared";

export type SelectedPiece = {
  id: PieceId,
  // selected: "selected" | "required",
  // Keys into config.mediaOverrides[pieceType][rosterPiece.version.logic] - a
  // piece may wear several at once as long as their `assets` lists don't overlap.
  mediaOverrides?: Array<Sha256>,
  required: Record<PieceType, {
    mandatory: Array<SelectedPiece>,
    selectable: Array<SelectedPiece>
  }>
};


export type UserSelection = Record<PieceType, Array<SelectedPiece>>;
