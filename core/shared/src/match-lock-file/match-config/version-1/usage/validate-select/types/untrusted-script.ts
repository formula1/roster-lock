
import {
  UserId,
  RosterLockV1Config,
  FinalSelection,  
  SelectedPiece
} from "@roster-lock/types";

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
  input: FinalSelection,
};


export type ScriptPurposeInput = (
  | PieceUserValidationInput
  | PieceMergeInput
  | GlobalValidationInput
)


export type ScriptStarter = {
  config: RosterLockV1Config,
  randomSeeds: string[],
  scripts: Record<string, string>,

  purpose: ScriptPurposeInput,

  entryScriptPath: string
}
