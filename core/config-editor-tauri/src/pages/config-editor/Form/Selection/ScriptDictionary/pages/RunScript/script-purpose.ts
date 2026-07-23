
export type ScriptPurpose = "piece-user-validation" | "piece-merge" | "global-validation";

import pieceValidationDescription from "./piece-validation-description.md";
import pieceMergeDescription from "./piece-merge-description.md";
import globalValidationDescription from "./global-validation-description.md"

export const SCRIPT_PURPOSES: Array<{ title: string, value: ScriptPurpose, description: string }> = [
  {
    title: "Piece Validation", value: "piece-user-validation", description: pieceValidationDescription
  },
  { title: "Piece Merge", value: "piece-merge", description: pieceMergeDescription },
  { title: "Global Validation", value: "global-validation", description: globalValidationDescription },

]

