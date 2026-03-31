import {
  RosterLockV1Schema, RosterLockV1SchemaKeywords, JSONSchemaCaster,
} from "@match-lock/shared";

import { ScriptStarter } from "@match-lock/shared";
import { ScriptPurposeInputSchema } from "./purpose-input";


import { JSONSchemaType } from "ajv";
const ScriptStarterSchema: JSONSchemaType<ScriptStarter> = {
  type: "object",
  required: ["config", "randomSeeds", "scripts", "purpose", "entryScriptPath"],
  additionalProperties: false,
  properties: {
    config: RosterLockV1Schema,
    randomSeeds: {
      type: "array",
      items: { type: "string" },
    },
    scripts: {
      type: "object",
      required: [],
      additionalProperties: { type: "string" },
    },
    purpose: ScriptPurposeInputSchema,
    entryScriptPath: { type: "string" },
  },
}

export const ScriptStarterCaster = new JSONSchemaCaster<ScriptStarter>(
  ScriptStarterSchema,
  RosterLockV1SchemaKeywords,
);
