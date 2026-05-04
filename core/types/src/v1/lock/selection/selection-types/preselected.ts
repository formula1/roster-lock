
// Can select pieces as a part of the config
// This is useful if players just want to play a specific stage without the chance of another being chosen
// Final Destination Fox only

import { JSONShallowObject, SelectionPieceMeta } from "../meta"
import { PieceId, PieceType } from "../../../shared"

// When selecting personal pieces, the array will be applied to all players
export type SelectionPreselectedConfig = {
  type: "preselected",
  pieceMeta: SelectionPieceMeta<JSONShallowObject>,
  pieces: Array<PreselectedPiece>
}
type PreselectedPiece = {
  id: PieceId,
  required: Record<PieceType, Array<PreselectedPiece>>,
}
