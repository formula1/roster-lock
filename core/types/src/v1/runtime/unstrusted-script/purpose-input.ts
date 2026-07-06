
import { UserId, PieceType } from "../../shared";
import { SelectedPiece } from "../../request";

export type PieceUserValidationInput = {
  type: "piece-user-validation",
  pieceType: string,
  userId: string,
  input: Array<SelectedPiece>,
};

export type PieceMergeInput = {
  type: "piece-merge",
  pieceType: string,
  users: Array<UserId>,
  input: Record<UserId, Array<SelectedPiece>>,
};

export type GlobalValidationInput = {
  type: "global-validation",
  pieceTypes: Array<string>,
  users: Array<UserId>,
  input: Record<PieceType, (
    | Record<UserId, Array<SelectedPiece>>
    | Array<SelectedPiece>
  )> ,
};


export type ScriptPurposeInput = (
  | PieceUserValidationInput
  | PieceMergeInput
  | GlobalValidationInput
);
