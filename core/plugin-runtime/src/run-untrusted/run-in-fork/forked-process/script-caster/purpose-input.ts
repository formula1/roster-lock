import {
  PieceUserValidationInput,
  PieceMergeInput,
  GlobalValidationInput,
  ScriptPurposeInput,
} from "@roster-lock/types";
import { SelectedPieceSchema, SelectedPieceSchemaDef } from "@roster-lock/shared";

import { JSONSchemaType } from "ajv";

const PieceUserValidationInputSchema: JSONSchemaType<PieceUserValidationInput> = {
  type: "object",
  required: ["type", "pieceType", "userId", "input"],
  additionalProperties: false,
  properties: {
    type: { type: "string", const: "piece-user-validation" },
    pieceType: { type: "string" },
    userId: { type: "string" },
    input: {
      type: "array",
      items: SelectedPieceSchema,
    },
  },
};

const PieceMergeInputSchema: JSONSchemaType<PieceMergeInput> = {
  type: "object",
  required: ["type", "pieceType", "users", "input"],
  additionalProperties: false,
  properties: {
    type: { type: "string", const: "piece-merge" },
    pieceType: { type: "string" },
    users: {
      type: "array",
      items: { type: "string" },
    },
    input: {
      type: "object",
      required: [],
      additionalProperties: {
        type: "array",
        items: SelectedPieceSchema,
      },
    },
  },
};

const GlobalValidationInputSchema: JSONSchemaType<GlobalValidationInput> = {
  type: "object",
  required: ["type", "users", "pieceTypes", "input"],
  additionalProperties: false,
  properties: {
    type: { type: "string", const: "global-validation" },
    users: {
      type: "array",
      items: { type: "string" },
    },
    pieceTypes: {
      type: "array",
      items: { type: "string" },
    },
    input: {
      type: "object",
      required: [],
      additionalProperties: {
        anyOf: [
          // For personal Selections { [userId: string]: Array<SelectedPiece> }
          {
            type: "object",
            required: [],
            additionalProperties: {
              type: "array",
              items: SelectedPieceSchema,
            },
          },
          // For shared Selections Array<SelectedPiece>
          {
            type: "array",
            items: SelectedPieceSchema,
          },
        ]
      },
    },
  },
};


// AJV's JSONSchemaType requires a top-level `type`, but union types use anyOf without one
export const ScriptPurposeInputSchema = {
  $id: "purpose-schema",
  ...SelectedPieceSchemaDef,
  anyOf: [
    PieceUserValidationInputSchema,
    PieceMergeInputSchema,
    GlobalValidationInputSchema,
  ]
} as unknown as JSONSchemaType<ScriptPurposeInput>;

