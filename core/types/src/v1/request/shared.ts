import { PieceId, PieceType } from "../shared";

export type SelectedPiece = {
  id: PieceId,
  // selected: "selected" | "required",
  required: Record<PieceType, {
    mandatory: Array<SelectedPiece>,
    selectable: Array<SelectedPiece>
  }>
};


export type UserSelection = Record<PieceType, Array<SelectedPiece>>;
