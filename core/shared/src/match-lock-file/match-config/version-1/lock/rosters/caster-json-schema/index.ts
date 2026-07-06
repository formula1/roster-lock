import { JSONSchemaType } from "ajv";
import { defineKeyword } from "../../../../../util-types/json-schema";
import { RosterLockV1Config } from "@roster-lock/types";
type RosterLockPiece = RosterLockV1Config["rosters"][string][number];

import { idSchema, idUniquenessSchemaValidator, idSchemaValidator } from "./id";
import { versionSchema, sha256SchemaValidator } from "./version";
import { humanInfoSchema, urlSchemaValidator, friendlyStringSchemaValidator } from "./human";
import {
  downloadableSourcesSchema,
  downloadableSourceListSchemaValidator,
} from "./downloadableSources";
import {
  pathVariablesSchema,
  pathVariableNameSchemaValidator,
  pathVariableValueSchemaValidator,
  allPathVariableNameSetSchemaValidator,
} from "./pathVariables";
import {
  requiredPiecesSchema,
  allRequiredPieceTypesSetSchemaValidator,
  requiredPieceValueSchemaValidator,
  requiredPieceTypeSchemaValidator,
} from "./requiresPieces";


const pieceTypeInEngineSchemaValidator = defineKeyword({
  keyword: "rosterPieceTypeInEngine",
  type: "object",
  validate: function (piece: RosterLockPiece, { engine }: RosterLockV1Config, path){
    // config/pieces/pieceType/pieceIndex
    const pieceType = path.split("/").at(-2);
    if(!pieceType) throw new Error("Invalid path");
    validatePieceInEngine(pieceType, engine);
  }
});

export const rosterLockPiece: JSONSchemaType<RosterLockPiece> = {
  type: "object",
  [pieceTypeInEngineSchemaValidator.keyword]: true,
  required: ["id", "version", "humanInfo", "downloadSources", "pathVariables", "requiredPieces"],
  additionalProperties: false,
  properties: {
    id: idSchema,
    version: versionSchema,
    humanInfo: humanInfoSchema,
    downloadSources: downloadableSourcesSchema,
    pathVariables: pathVariablesSchema,
    requiredPieces: requiredPiecesSchema,
  },
};


import { validateAllEnginePiecesDefined, validatePieceInEngine } from "../validate";
const allPieceTypesInEngineSchemaValidator = defineKeyword({
  keyword: "allEnginePieceTypesInRoster",
  type: "object",
  validate: function (rosters: RosterLockV1Config["rosters"], { engine }: RosterLockV1Config, path){
    validateAllEnginePiecesDefined(rosters, engine);
  }
});

export const rostersSchema: JSONSchemaType<RosterLockV1Config["rosters"]> = {
  type: "object",
  [allPieceTypesInEngineSchemaValidator.keyword]: true,
  required: [],
  additionalProperties: {
    type: "array",
    items: rosterLockPiece,
  },
};


export const rosterKeywords = [
  // Download Related
  downloadableSourceListSchemaValidator,

  // Human Related
  urlSchemaValidator,
  friendlyStringSchemaValidator,

  // Id Related
  idSchemaValidator,
  idUniquenessSchemaValidator,

  // Path Variable Related
  pathVariableNameSchemaValidator,
  pathVariableValueSchemaValidator,
  allPathVariableNameSetSchemaValidator,

  // Required Piece Related
  allRequiredPieceTypesSetSchemaValidator,
  requiredPieceValueSchemaValidator,
  requiredPieceTypeSchemaValidator,

  // Version Related
  sha256SchemaValidator,


  // Defined Here
  allPieceTypesInEngineSchemaValidator,
  pieceTypeInEngineSchemaValidator,
];
