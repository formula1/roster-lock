import { JSONSchemaType } from "ajv";
import { RosterLockV1Config } from "@roster-lock/types";
import { countSchema, countSchemaValidator } from "../../../../shared/count";
type RosterLockEngineConfig = RosterLockV1Config["engine"];


import {
  assetNameSchemaValidator,
  assetGlobListSchemaValidator,
  assetGlobPathVariablesSchemaValidator,
  assetGlobItemSchemaValidator,
} from "./keywords";
export const assetsSchema: JSONSchemaType<
  RosterLockEngineConfig["pieceDefinitions"][string]["assets"]
> = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    required: ["name", "classification", "count", "glob"],
    properties: {
      name: {
        [assetNameSchemaValidator.keyword]: true,
        type: "string"
      },
      classification: { type: "string", enum: ["logic", "media", "doc"] },
      count: countSchema,
      glob: {
        [assetGlobListSchemaValidator.keyword]: true,
        type: "array",
        items: {
          [assetGlobPathVariablesSchemaValidator.keyword]: true,
          [assetGlobItemSchemaValidator.keyword]: true,
          type: "string",
        },
      },
    }
  }
};

export const assetKeywords = [
  assetNameSchemaValidator,
  countSchemaValidator,
  assetGlobListSchemaValidator,
  assetGlobPathVariablesSchemaValidator,
  assetGlobItemSchemaValidator,
];