import { UntrustedScriptRef } from "../script";
import { PieceId, Count } from "../../../shared";

export type UserSelectionValidation = {
  count: Count,
  unique: boolean,
  banList: Array<PieceId>,
  customValidation: Array<UntrustedScriptRef>
};


export type SelectionNormalConfig = {
  type: "normal",

  /*
    The validation is used to validate the current user's and other player's choices
    The validation does not validate the final choices after the merge algorithm is run
  */
  validation: UserSelectionValidation,

  /*
    A merge algorithm takes in each player's choices and returns a new set of choices
    If the pieceType is "personal", the merge algorithm is expected to return a set of choices per player
    If the pieceType is "shared", the merge algorithm is expected to return a single set of choices
    - the mergeAlgorithm is mandatory for "shared" pieces
    If the pieceType is "on demand", the merge algorithm is not allowed
    
    We validate the return type of the algorithm to ensure it matches the pieceType
  */
  mergeAlgorithm?: UntrustedScriptRef
};

