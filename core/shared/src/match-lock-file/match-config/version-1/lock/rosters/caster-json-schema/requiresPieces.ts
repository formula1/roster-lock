import { JSONSchemaType } from "ajv";
import { RosterLockV1Config } from "@roster-lock/types";
type RosterLockPiece = RosterLockV1Config["rosters"][string][number];
import { defineKeyword } from "../../../../../util-types/json-schema";
import {
  validateAllExpectedRequiredPieceTypesSet,
  validateRequiredPieceType,
  validateRequiredPieceValue
} from "../validate";

export const allRequiredPieceTypesSetSchemaValidator = defineKeyword({
  keyword: "rosterAllRequiredPieceTypesSet",
  type: "object",
  // config/pieces/pieceType/pieceIndex/requiredPieces
  validate: function (requiredPieces, { engine }: RosterLockV1Config, path){
    const pieceType = path.split("/").at(-3);
    if(!pieceType) throw new Error("Invalid path");
    const pieceDefinition = engine.pieceDefinitions[pieceType];
    validateAllExpectedRequiredPieceTypesSet(requiredPieces, pieceDefinition);
  }
});

export const requiredPieceValueSchemaValidator = defineKeyword({
  keyword: "rosterRequiredPieceValue",
  type: "string",
  // rosters/pieceType/pieceIndex/requiredPieces/requiredPieceType/expected/index
  validate: function (requiredPiece: string, { rosters }: RosterLockV1Config, path){
    const pathParts = path.split("/");
    pathParts.pop();
    const pieceType = pathParts.at(-2);
    if(!pieceType) throw new Error("Invalid path");
    const pieceValues = rosters[pieceType];
    validateRequiredPieceValue(pieceType, requiredPiece, pieceValues);
  }
});

export const requiredPieceTypeSchemaValidator = defineKeyword({
  keyword: "rosterRequiredPieceType",
  type: "object",
  // config/pieces/pieceType/pieceIndex/requiredPieces/pieceType
  validate: function (requiredPiece: string, config: RosterLockV1Config, path){
    const pathParts = path.split("/");
    const pieceType = pathParts.at(-1);
    if(!pieceType) throw new Error("Invalid path");

    validateRequiredPieceType(pieceType, config);
  }
});


export const requiredPiecesSchema: JSONSchemaType<RosterLockPiece["requiredPieces"]> = {
  type: "object",
  [allRequiredPieceTypesSetSchemaValidator.keyword]: true,
  required: [],
  additionalProperties: {
    type: "object",
    [requiredPieceTypeSchemaValidator.keyword]: true,
    required: ["expected", "selectable"],
    additionalProperties: false,
    properties: {
      expected: {
        type: "array",
        items: {
          type: "string",
          [requiredPieceValueSchemaValidator.keyword]: true,
        },
      },
      selectable: { type: "boolean" },
    },
  }
};
