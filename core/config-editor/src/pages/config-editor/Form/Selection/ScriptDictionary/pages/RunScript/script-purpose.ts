import { ScriptPurposeInput } from "@roster-lock/shared";


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

export function defaultPurposeInput(purpose: ScriptPurpose, pieceType?: string): ScriptPurposeInput {
  if (purpose === "piece-user-validation") {
    return {
      type: "piece-user-validation",
      pieceType: pieceType ?? "piece",
      userId: "test-user",
      input: [],
    };
  }
  if (purpose === "piece-merge") {
    return {
      type: "piece-merge",
      pieceType: pieceType ?? "piece",
      users: ["player1", "player2"],
      input: { "player1": [], "player2": [] },
    };
  }
  return {
    type: "global-validation",
    pieceTypes: [],
    users: ["player1", "player2"],
    input: {},
  };
}
