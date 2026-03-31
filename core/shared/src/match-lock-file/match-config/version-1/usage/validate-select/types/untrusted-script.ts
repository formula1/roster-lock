import {
  UserId,
  UserSelection,
  AllUsersSelection,
  FinalSelection,
} from "./selection";

import { RosterLockV1Config } from "../../../types";

export type PieceUserValidationInput = {
  type: "piece-user-validation",
  pieceType: string,
  userId: string,
  input: UserSelection,
};

export type PieceMergeInput = {
  type: "piece-merge",
  pieceType: string,
  users: Array<UserId>,
  input: AllUsersSelection,
};

export type GlobalValidationInput = {
  type: "global-validation",
  users: Array<UserId>,
  pieceTypes: Array<string>,
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
