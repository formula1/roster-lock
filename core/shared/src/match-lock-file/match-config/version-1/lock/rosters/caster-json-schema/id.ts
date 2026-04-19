import { JSONSchemaType } from "ajv";

import { defineKeyword } from "../../../../../util-types/json-schema";
import { validatePieceId, validatePieceIdUniqueness } from "../validate";
import { RosterLockV1Config } from "@roster-lock/types";


export const idSchemaValidator = defineKeyword({
  keyword: "rosterPieceId",
  type: "string",
  validate: validatePieceId
});

export const idUniquenessSchemaValidator = defineKeyword({
  keyword: "rosterPieceIdUniqueness",
  type: "string",
  validate: function (id: string, { rosters }: RosterLockV1Config, path){
    // config/rosters/pieceType/pieceIndex/id
    const pathParts = path.split("/");
    const pieceIndex = Number(pathParts.at(-2));
    if(Number.isNaN(pieceIndex)) throw new Error(`Invalid path: pieceIndex ${pieceIndex} is not a number`);
    const pieceType = pathParts.at(-3);
    if(!pieceType) throw new Error("Invalid path: no pieceType");
    const pieceList = rosters[pieceType];
    validatePieceIdUniqueness(id, pieceIndex, pieceList);
  }
});

export const idSchema: JSONSchemaType<string> = {
  type: "string",
  [idSchemaValidator.keyword]: true,
  [idUniquenessSchemaValidator.keyword]: true,
}
