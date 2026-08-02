
import { JSONSchemaType } from "ajv";
import { JSONSchemaCaster } from "../../../util-types/json-schema";
import { engineKeywords, engineSchema } from "./engine";
export * from "./engine";
import { rosterKeywords, rostersSchema } from "./rosters";
export * from "./rosters";
import { mediaOverrideKeywords, mediaOverridesSchema } from "./media-overrides";
export * from "./media-overrides";
import { selectionKeywords, selectionConfigSchema  } from "./selection";
export * from "./selection";
import { pieceMetaKeywords, pieceMetaSchema } from "./piece-meta";
export * from "./piece-meta";
import { sharedKeywords } from "../shared";

import { RosterLockV1Config } from "@roster-lock/types";

import { buildIdentity } from "../shared";

export const RosterLockV1Schema: JSONSchemaType<RosterLockV1Config> = {
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
    // mediaOverrides is optional on RosterLockV1Config - ajv's JSONSchemaType
    // inference doesn't cleanly narrow an optional property whose own schema
    // has nested keyword-bearing properties, same wrinkle RosterLockV1DraftSchema
    // works around below with its own `as` cast.
    mediaOverrides: mediaOverridesSchema,
    selection: selectionConfigSchema,
    pieceMeta: pieceMetaSchema,
  },
} as JSONSchemaType<RosterLockV1Config>;

export const RosterLockV1SchemaKeywords = [
  ...sharedKeywords,
  ...engineKeywords,
  ...rosterKeywords,
  ...mediaOverrideKeywords,
  ...selectionKeywords,
  ...pieceMetaKeywords,
];


export const ROSTERLOCK_V1_CASTER_JSONSCHEMA = new JSONSchemaCaster<
  RosterLockV1Config
>(RosterLockV1Schema,RosterLockV1SchemaKeywords);
