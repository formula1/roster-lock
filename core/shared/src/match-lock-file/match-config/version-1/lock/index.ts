
import { JSONSchemaType } from "ajv";
import { JSONSchemaCaster } from "../../../util-types/json-schema";
import { engineKeywords, engineSchema } from "./engine";
export * from "./engine";
import { rosterKeywords, rostersSchema } from "./rosters";
export * from "./rosters";
import { selectionKeywords, selectionConfigSchema  } from "./selection";
export * from "./selection";
import { pieceMetaKeywords, pieceMetaSchema } from "./piece-meta";
export * from "./piece-meta";
import { sharedKeywords } from "../shared";

import { RosterLockV1Config } from "@roster-lock/types";

import { buildIdentity } from "../shared";

export const RosterLockV1Schema: JSONSchemaType<RosterLockV1Config> =   {
  type: "object",
  required: [
    "configIdentity",
    "author", "title", "version",
    "engine", "rosters", "selection", "pieceMeta"
  ],
  additionalProperties: false,
  properties: {
    configIdentity: buildIdentity("lock", 1),

    author: { type: "string" },
    title: { type: "string" },
    version: { type: "string" },

    engine: engineSchema,
    rosters: rostersSchema,
    selection: selectionConfigSchema,
    pieceMeta: pieceMetaSchema,
  },
};

export const RosterLockV1SchemaKeywords = [
  ...sharedKeywords,
  ...engineKeywords,
  ...rosterKeywords,
  ...selectionKeywords,
  ...pieceMetaKeywords,
];


export const ROSTERLOCK_V1_CASTER_JSONSCHEMA = new JSONSchemaCaster<
  RosterLockV1Config
>(RosterLockV1Schema,RosterLockV1SchemaKeywords);
