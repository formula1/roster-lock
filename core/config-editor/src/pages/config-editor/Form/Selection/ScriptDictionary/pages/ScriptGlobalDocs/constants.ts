import { ScriptPurpose } from "../RunScript/script-purpose";

export const COMMON_GLOBALS = [
  { name: "randomFloat()", type: "number", description: "Seeded random float in [0, 1)" },
  { name: "randomInt(min, max)", type: "number", description: "Seeded random integer in [min, max]" },
  { name: "shuffleIndexes(length)", type: "number[]", description: "Seeded shuffle of indexes 0..length-1" },
  { name: "getPieceMeta(pieceType, pieceId)", type: "object", description: "Returns the meta object for a specific piece" },
  { name: "getAvailablePieces(pieceType)", type: "string[]", description: "Returns all available piece ids for a piece type" },
];

export const PURPOSE_GLOBALS: Record<ScriptPurpose, Array<{ name: string; type: string }>> = {
  "piece-user-validation": [
    { name: "scriptPurpose", type: '"piece-user-validation"' },
    { name: "pieceType", type: "string" },
    { name: "selection", type: "SelectedPiece[]" },
  ],
  "piece-merge": [
    { name: "scriptPurpose", type: '"piece-merge"' },
    { name: "pieceType", type: "string" },
    { name: "users", type: "string[]" },
    { name: "selection", type: "{ [userId: string]: SelectedPiece[] }" },
  ],
  "global-validation": [
    { name: "scriptPurpose", type: '"global-validation"' },
    { name: "pieceTypes", type: "string[]" },
    { name: "users", type: "string[]" },
    { name: "selection", type: "{ [pieceType: string]: SelectedPiece[] | { [userId: string]: SelectedPiece[] } }" },
  ],
};

export const PURPOSE_RETURN: Record<ScriptPurpose, string> = {
  "piece-user-validation": "void | boolean | [boolean, string] | string",
  "piece-merge": "SelectedPiece[] (shared) | { [userId: string]: SelectedPiece[] } (personal)",
  "global-validation": "void | boolean | [boolean, string] | string",
};

