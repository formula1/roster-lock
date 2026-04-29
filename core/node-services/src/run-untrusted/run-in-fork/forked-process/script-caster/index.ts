import {
  RosterLockV1Schema, RosterLockV1SchemaKeywords, JSONSchemaCaster,
} from "@roster-lock/shared";

import { ScriptStarter } from "@roster-lock/shared";
import { ScriptPurposeInputSchema } from "./purpose-input";


import { JSONSchemaType } from "ajv";
const ScriptStarterSchema: JSONSchemaType<ScriptStarter> = {
  type: "object",
  required: ["config", "randomSeeds", "purpose", "entryScriptPath"],
  additionalProperties: false,
  properties: {
    config: RosterLockV1Schema,
    randomSeeds: {
      type: "array",
      items: { type: "string" },
    },
    purpose: ScriptPurposeInputSchema,
    entryScriptPath: { type: "string" },
  },
}

export const ScriptStarterCaster = new JSONSchemaCaster<ScriptStarter>(
  ScriptStarterSchema,
  RosterLockV1SchemaKeywords,
);
