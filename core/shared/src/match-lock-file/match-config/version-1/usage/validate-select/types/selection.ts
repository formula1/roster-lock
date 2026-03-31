import { JSONSchemaType } from "ajv";
import { UserId, PieceType, PieceId } from "../../../../../config-types";

export { UserId, PieceType, PieceId };

export type SelectedPiece = {
  id: PieceId,
  // selected: "selected" | "required",
  required: Record<PieceType, Array<SelectedPiece>>,
}

export type UserInput = {
  randomSeed: string,
  userSelection: Record<PieceType, Array<SelectedPiece>>
}

export type UserSelection = Array<SelectedPiece>;
export type AllUsersSelection = Record<UserId, Array<SelectedPiece>>;
export type FinalSelection = Record<PieceType, (
  | { type: "shared", value: Array<SelectedPiece> } // Shared Selection
  | { type: "personal", value: Record<UserId, Array<SelectedPiece>> } // Personal Selection
)>;
