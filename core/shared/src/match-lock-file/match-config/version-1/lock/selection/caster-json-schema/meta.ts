
import { JSONSchemaType } from "ajv";
import { defineKeyword } from "../../../../../util-types/json-schema";
import { RosterLockV1Config, SelectionPieceMeta, JSONShallowObject } from "@roster-lock/types";

import { validateMetaDefaultValue, validateMetaForPiece } from "../validate/meta";

export const metaDefaultValueSchemaValidator = defineKeyword({
  keyword: "metaDefaultValue",
  type: "object",
  validate: (defaultMeta: JSONShallowObject, { selection }: RosterLockV1Config, path)=>{
    const pathParts = path.split("/");
    // /selection/piece/pieceType/pieceMeta/defaultMeta
    const pieceType = pathParts[3];
    const sharedPieceMeta = selection.piece[pieceType].pieceMeta;
    if(!sharedPieceMeta){
      throw new Error(`Piece type ${pieceType} does not have shared piece meta`);
    }
    validateMetaDefaultValue(sharedPieceMeta.schema, defaultMeta);
  },
});


export const metaPieceValueSchemaValidator = defineKeyword({
  keyword: "metaPieceValue",
  type: "object",
  validate: (pieceMeta: JSONShallowObject, { selection, rosters }: RosterLockV1Config, path)=>{
    const pathParts = path.split("/");
    // /selection/piece/pieceType/pieceMeta/pieceMeta/pieceId
    const pieceType = pathParts[3];
    const pieceId = pathParts[6]?.replace(/~1/g, "/").replace(/~0/g, "~");
    const sharedPieceMeta = selection.piece[pieceType].pieceMeta;
    if(!sharedPieceMeta){
      throw new Error(`Piece type ${pieceType} does not have shared piece meta`);
    }
    const roster = rosters[pieceType];
    if(!roster){
      throw new Error(`Piece type ${pieceType} does not have a roster`);
    }
    validateMetaForPiece(sharedPieceMeta.schema, pieceId, pieceMeta, roster);
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
  required: ["schema","defaultMeta", "pieceMeta"],
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
    pieceMeta: {
      type: "object",
      required: [],
      additionalProperties: {
        ...shallowObjectSchema,
        [metaPieceValueSchemaValidator.keyword]: true,
      }
    },
  },
};
