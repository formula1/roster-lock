
import { humanInfoSchema, urlSchemaValidator } from "./human";
import {
  downloadableSourcesSchema,
  downloadableSourceSchemaValidator,
  downloadableSourceListSchemaValidator,
} from "./downloadableSources";
import {
  pathVariablesSchema,
  pathVariableNameSchemaValidator,
  pathVariableValueSchemaValidator,
  allPathVariableNameSetSchemaValidator,
} from "./pathVariables";

import { JSONSchemaType } from "ajv";

import { RosterLockV1PieceMetadata } from "@roster-lock/types";
import { defineKeyword } from "../../../../util-types/json-schema";

export const rosterLockPieceMetadataSchema: JSONSchemaType<RosterLockV1PieceMetadata> = {
  type: "object",
  required: ["rosterlockVersion", "humanInfo", "downloadSources", "pathVariables"],
  additionalProperties: false,
  properties: {
    rosterlockVersion: { type: "number", const: 1 },
    humanInfo: humanInfoSchema,
    downloadSources: downloadableSourcesSchema,
    pathVariables: pathVariablesSchema,
  },
}

function ignore(){ return true; }

export const rosterLockPieceMetadataKeywords = [
  urlSchemaValidator,
  downloadableSourceSchemaValidator,
  downloadableSourceListSchemaValidator,
  defineKeyword({
    keyword: pathVariableNameSchemaValidator.keyword,
    type: pathVariableNameSchemaValidator.type,
    validate: ignore,
  }),
  defineKeyword({
    keyword: pathVariableValueSchemaValidator.keyword,
    type: pathVariableValueSchemaValidator.type,
    validate: ignore,
  }),
  defineKeyword({
    keyword: allPathVariableNameSetSchemaValidator.keyword,
    type: allPathVariableNameSetSchemaValidator.type,
    validate: ignore,
  }),
]
