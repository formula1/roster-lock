import { JSONSchemaType } from "ajv";
import { RosterLockEngineConfig } from "../types";

import { assetsSchema, assetKeywords } from "./asset";
import { requirementsSchema, requirementKeywords } from "./requirements";
import { pathVariablesSchema, pathVariableKeywords } from "./variables";

const pieceDefinitionSchema: JSONSchemaType<
  RosterLockEngineConfig["pieceDefinitions"][string]
> = {
  type: "object",
  required: ["selectionStrategy", "requires", "pathVariables", "assets"],
  additionalProperties: false,
  properties: {
    selectionStrategy: { type: "string", enum: ["mandatory", "personal", "shared", "on demand"] },
    pathVariables: pathVariablesSchema,
    requires: requirementsSchema,
    assets: assetsSchema,
  },
}

export const engineSchema: JSONSchemaType<RosterLockEngineConfig> = {
  type: "object",
  required: ["name", "version", "pieceDefinitions"],
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    version: { type: "string" },
    pieceDefinitions: {
      type: "object",
      required: [],
      additionalProperties: pieceDefinitionSchema
    }
  }
}

export const engineKeywords = [
  ...pathVariableKeywords,
  ...requirementKeywords,
  ...assetKeywords,
]

