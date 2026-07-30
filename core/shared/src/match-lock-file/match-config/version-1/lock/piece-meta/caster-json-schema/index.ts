
import { JSONSchemaType } from "ajv";
import { defineKeyword } from "../../../../../util-types/json-schema";
import { RosterLockV1Config, SelectionPieceMeta, JSONShallowObject } from "@roster-lock/types";

import { validateMetaDefaultValue, validateMetaForPiece } from "../validate";

export const metaDefaultValueSchemaValidator = defineKeyword({
  keyword: "metaDefaultValue",
  type: "object",
  validate: (defaultMeta: JSONShallowObject, { pieceMeta }: RosterLockV1Config, path)=>{
    const pathParts = path.split("/");
    // /pieceMeta/pieceType/defaultMeta
    const pieceType = pathParts[2];
    const sharedPieceMeta = pieceMeta[pieceType];
    if(!sharedPieceMeta){
      throw new Error(`Piece type ${pieceType} does not have shared piece meta`);
    }
    validateMetaDefaultValue(sharedPieceMeta.schema, defaultMeta);
  },
});


export const metaPieceValueSchemaValidator = defineKeyword({
  keyword: "metaPieceValue",
  type: "object",
  validate: (pieceValue: JSONShallowObject, { pieceMeta, rosters }: RosterLockV1Config, path)=>{
    const pathParts = path.split("/");
    // /pieceMeta/pieceType/values/pieceId
    const pieceType = pathParts[2];
    const pieceId = pathParts[4]?.replace(/~1/g, "/").replace(/~0/g, "~");
    const sharedPieceMeta = pieceMeta[pieceType];
    if(!sharedPieceMeta){
      throw new Error(`Piece type ${pieceType} does not have shared piece meta`);
    }
    const roster = rosters[pieceType];
    if(!roster){
      throw new Error(`Piece type ${pieceType} does not have a roster`);
    }
    validateMetaForPiece(sharedPieceMeta.schema, pieceId, pieceValue, roster);
  },
});

const shallowObjectSchema = {
  type: "object",
  required: [],
  additionalProperties: {
    anyOf: [
      { type: "string" },
      { type: "number" },
      { type: "boolean" },
      { type: "array", items: { type: "string" } },
      { type: "array", items: { type: "number" } },
      { type: "array", items: { type: "boolean" } },
    ],
  },
} as const;


export const selectionPieceMetaSchema: JSONSchemaType<SelectionPieceMeta<JSONShallowObject>> = {
  type: "object",
  required: ["schema","defaultMeta", "values"],
  additionalProperties: false,
  properties: {
    schema: {
      type: "object",
      required: [],
      additionalProperties: {
        type: "string",
        enum: ["boolean", "number", "string", "boolean[]", "number[]", "string[]"],
      },
    },
    defaultMeta: {
      ...shallowObjectSchema,
      [metaDefaultValueSchemaValidator.keyword]: true,
    },
    values: {
      type: "object",
      required: [],
      additionalProperties: {
        ...shallowObjectSchema,
        [metaPieceValueSchemaValidator.keyword]: true,
      }
    },
  },
};

export const pieceMetaSchema: JSONSchemaType<RosterLockV1Config["pieceMeta"]> = {
  type: "object",
  required: [],
  additionalProperties: selectionPieceMetaSchema,
};

export const pieceMetaKeywords = [
  metaDefaultValueSchemaValidator,
  metaPieceValueSchemaValidator,
];
