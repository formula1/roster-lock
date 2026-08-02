import { JSONSchemaType } from "ajv";
import { RosterLockV1Config, MediaOverrideEntry } from "@roster-lock/types";
import { defineKeyword } from "../../../../../util-types/json-schema";

import {
  validateMediaOverridePieceType,
  validateMediaOverrideLogicHash,
  validateMediaOverrideAssets,
} from "../validate";
import { validateSha256 } from "../../rosters/validate/utils";
import { downloadableSourcesSchema } from "../../rosters/caster-json-schema/downloadableSources";

// mediaOverrides/pieceType
const mediaOverridePieceTypeInEngineSchemaValidator = defineKeyword({
  keyword: "mediaOverridePieceTypeInEngine",
  type: "object",
  validate: function (_value, { engine }: RosterLockV1Config, path){
    const pieceType = path.split("/").at(-1);
    if(!pieceType) throw new Error("Invalid path");
    validateMediaOverridePieceType(pieceType, engine);
  }
});

// mediaOverrides/pieceType/logicHash
const mediaOverrideLogicHashKnownSchemaValidator = defineKeyword({
  keyword: "mediaOverrideLogicHashKnown",
  type: "object",
  validate: function (_value, { rosters }: RosterLockV1Config, path){
    const parts = path.split("/");
    const logicHash = parts.at(-1);
    const pieceType = parts.at(-2);
    if(!logicHash || !pieceType) throw new Error("Invalid path");
    validateMediaOverrideLogicHash(logicHash, pieceType, rosters);
  }
});

// mediaOverrides/pieceType/logicHash/overrideHash
const mediaOverrideEntryValidSchemaValidator = defineKeyword({
  keyword: "mediaOverrideEntryValid",
  type: "object",
  validate: function (entry: MediaOverrideEntry, { engine }: RosterLockV1Config, path){
    const parts = path.split("/");
    const overrideHash = parts.at(-1);
    const pieceType = parts.at(-3);
    if(!overrideHash || !pieceType) throw new Error("Invalid path");
    validateSha256(overrideHash);
    validateMediaOverrideAssets(entry.assets, pieceType, engine);
  }
});

const mediaOverrideEntrySchema: JSONSchemaType<MediaOverrideEntry> = {
  type: "object",
  [mediaOverrideEntryValidSchemaValidator.keyword]: true,
  required: ["name", "assets", "downloadSources"],
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    assets: {
      type: "array",
      items: { type: "string" },
    },
    downloadSources: downloadableSourcesSchema,
  },
};

// Optional on RosterLockV1Config (nullable:true is ajv's JSONSchemaType convention for
// a TS-optional property - most configs have no skins, so this shouldn't be a mandatory
// empty `{}` every roster author has to remember to write). Typed against the non-optional
// shape here since this const is also reused standalone; RosterLockV1Schema casts around
// the mismatch the same way the draft schema does for its own $ref/optional wrinkles.
export const mediaOverridesSchema: JSONSchemaType<NonNullable<RosterLockV1Config["mediaOverrides"]>> = {
  type: "object",
  nullable: true,
  required: [],
  additionalProperties: {
    type: "object",
    [mediaOverridePieceTypeInEngineSchemaValidator.keyword]: true,
    required: [],
    additionalProperties: {
      type: "object",
      [mediaOverrideLogicHashKnownSchemaValidator.keyword]: true,
      required: [],
      additionalProperties: mediaOverrideEntrySchema,
    },
  },
};

export const mediaOverrideKeywords = [
  mediaOverridePieceTypeInEngineSchemaValidator,
  mediaOverrideLogicHashKnownSchemaValidator,
  mediaOverrideEntryValidSchemaValidator,
];
