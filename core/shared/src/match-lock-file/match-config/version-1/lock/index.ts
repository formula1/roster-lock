
import { JSONSchemaType } from "ajv";
import { JSONSchemaCaster } from "../../../util-types/json-schema";
import { engineKeywords, engineSchema } from "./engine";
import { rosterKeywords, rostersSchema } from "./rosters";
import { selectionKeywords, selectionConfigSchema,  } from "./selection";

import { RosterLockV1Config } from "@roster-lock/types";

export const RosterLockV1Schema: JSONSchemaType<RosterLockV1Config> =   {
  type: "object",
  required: ["configPurpose", "configVersion", "version", "engine", "rosters", "selection"],
  additionalProperties: false,
  properties: {
    configPurpose: { type: "string", const: "lock" },
    configVersion: { type: "number", const: 1 },
    version: { type: "string" },
    engine: engineSchema,
    rosters: rostersSchema,
    selection: selectionConfigSchema,
  },
};

export const RosterLockV1SchemaKeywords = [
  ...engineKeywords,
  ...rosterKeywords,
  ...selectionKeywords,
]


export const ROSTERLOCK_V1_CASTER_JSONSCHEMA = new JSONSchemaCaster<
  RosterLockV1Config
>(RosterLockV1Schema,RosterLockV1SchemaKeywords)
