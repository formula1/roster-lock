import { JSONShallowObject, SelectionPieceMeta } from "../meta"
import { GasLimittedScript } from "../script"
import { PieceId } from "../shared"

export type UserSelectionValidation = {
  count: number | "*" | [number, number | "*"],
  unique: boolean,
  banList?: Array<PieceId>,
  customValidation: Array<GasLimittedScript>
}


export type SelectionNormalConfig = {
  type: "normal",
  /*
  Shared meta exists so there doesn't have to be duplication of metadata between validation and merging
  If a path of the shared meta intersects with validation of merge meta then its invalid
  */
  pieceMeta?: SelectionPieceMeta<JSONShallowObject>,

  /*
    The validation is used to validate the current user's and other player's choices
    The validation does not validate the final choices after the merge algorithm is run
  */
  validation?: UserSelectionValidation,

  /*
    A merge algorithm takes in each player's choices and returns a new set of choices
    If the pieceType is "personal", the merge algorithm is expected to return a set of choices per player
    If the pieceType is "shared", the merge algorithm is expected to return a single set of choices
    - the mergeAlgorithm is mandatory for "shared" pieces
    If the pieceType is "on demand", the merge algorithm is not allowed
    
    We validate the return type of the algorithm to ensure it matches the pieceType
  */
  mergeAlgorithm?: GasLimittedScript
}

