import { PieceType, SelectedPiece } from "@roster-lock/types";

export type UserInput = {
  randomSeed: string,
  userSelection: Record<PieceType, Array<SelectedPiece>>
}
