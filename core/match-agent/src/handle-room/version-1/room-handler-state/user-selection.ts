import {
  RosterLockV1Config, SelectedPiece, UserInput,
  PieceType, UserId,
  FinalSelection,
  runSelection,
} from "@match-lock/shared";
import { JSONSchemaType } from "ajv";

// Using 'as unknown as' because AJV's JSONSchemaType doesn't handle recursive $ref well
export const selectedPieceSchema: JSONSchemaType<SelectedPiece> = {
  $id: "SelectedPiece",
  type: "object",
  required: ["id", "required"],
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    required: {
      type: "object",
      required: [],
      additionalProperties: {
        type: "array",
        items: { $ref: "SelectedPiece" },
      },
    },
  },
} as unknown as JSONSchemaType<SelectedPiece>;

export const userInputSchema: JSONSchemaType<UserInput> = {
  type: "object",
  required: ["randomSeed", "userSelection"],
  additionalProperties: false,
  properties: {
    randomSeed: { type: "string" },
    userSelection: {
      type: "object",
      required: [],
      additionalProperties: {
        type: "array",
        items: selectedPieceSchema,
      },
    },
  },
}

import { runUntrustedScript } from "@roster-lock/node-services";
export function finalizeSelection(
  config: RosterLockV1Config,
  scriptsByPath: Record<string, string>,
  gameControlledSelections: Record<PieceType, Array<SelectedPiece> | Record<UserId, Array<SelectedPiece>>>,
  userInputs: Record<UserId, UserInput>,
): Promise<FinalSelection> {

  return runSelection(
    config,
    scriptsByPath,
    gameControlledSelections,
    userInputs,
    runUntrustedScript
  )
}

export const finalSelectionSchema: JSONSchemaType<FinalSelection> = {
  type: "object",
  required: [],
  additionalProperties: {
    anyOf: [
      {
        type: "object",
        required: ["type", "value"],
        additionalProperties: false,
        properties: {
          type: { type: "string", const: "shared" },
          value: {
            type: "array",
            items: selectedPieceSchema,
          },
        },
      },
      {
        type: "object",
        required: ["type", "value"],
        additionalProperties: false,
        properties: {
          type: { type: "string", const: "personal" },
          value: {
            type: "object",
            required: [],
            additionalProperties: {
              type: "array",
              items: selectedPieceSchema,
            },
          },
        },
      },
    ],
  }
}
