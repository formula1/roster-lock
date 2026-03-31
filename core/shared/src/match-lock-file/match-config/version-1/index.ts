export * from "./types";

import { JSONSchemaType } from "ajv";
import { JSONSchemaCaster } from "../../util-types/json-schema";
import { engineKeywords, engineSchema } from "./engine";
import { rosterKeywords, rostersSchema } from "./rosters";
import { selectionKeywords, selectionConfigSchema,  } from "./selection";

export * from "./engine";
export * from "./rosters";
export * from "./selection";

import { RosterLockV1Config } from "./types";

export const RosterLockV1Schema: JSONSchemaType<RosterLockV1Config> =   {
  type: "object",
  required: ["version", "engine", "rosters", "selection"],
  additionalProperties: false,
  properties: {
    version: { type: "number", const: 1 },
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


export * from "./usage";
