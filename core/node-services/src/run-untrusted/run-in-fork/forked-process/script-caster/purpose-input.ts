import {
  PieceUserValidationInput,
  PieceMergeInput,
  GlobalValidationInput,
  ScriptPurposeInput,
} from "@match-lock/shared";

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
      items: { type: "object", required: ["id"], additionalProperties: true },
    },
  },
}

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
        items: { type: "object", required: ["id"], additionalProperties: true },
      },
    },
  },
}

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
          {
            type: "object",
            required: ["type"],
            additionalProperties: false,
            properties: {
              type: { type: "string", const: "personal" },
              value: {
                type: "object",
                required: [],
                additionalProperties: {
                  type: "array",
                  items: { type: "object", required: ["id"], additionalProperties: true },
                },
              },
            },
          },
          {
            type: "object",
            required: ["type"],
            additionalProperties: false,
            properties: {
              type: { type: "string", const: "shared" },
              value: {
                type: "array",
                items: { type: "object", required: ["id"], additionalProperties: true },
              },
            },
          }
        ]
      },
    },
  },
}


export const ScriptPurposeInputSchema: JSONSchemaType<ScriptPurposeInput> = {
  anyOf: [
    PieceUserValidationInputSchema,
    PieceMergeInputSchema,
    GlobalValidationInputSchema,
  ]
}