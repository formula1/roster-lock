import { JSONSchemaType } from "ajv";
import { RosterLockV1Config } from "@roster-lock/types";
type RosterLockEngineConfig = RosterLockV1Config["engine"];

import { assetCountSchemaValidator } from "./keywords";
const countSchema: JSONSchemaType<
  RosterLockEngineConfig["pieceDefinitions"][string]["assets"][number]["count"]
> = {
  [assetCountSchemaValidator.keyword]: true,
  type: ["number", "string", "array"],
  anyOf: [
    { type: "number", minimum: 1 },
    { type: "string", const: "*" },
    {
      type: "array",
      items: [
        { type: "number", minimum: 0 },
        { anyOf: [{ type: "number", minimum: 1 }, { type: "string", const: "*" }] },
      ],
      minItems: 2,
      maxItems: 2,
    },
  ],
}

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
}

export const assetKeywords = [
  assetNameSchemaValidator,
  assetCountSchemaValidator,
  assetGlobListSchemaValidator,
  assetGlobPathVariablesSchemaValidator,
  assetGlobItemSchemaValidator,
]