
import {
  downloadableSourcesSchema,
} from "../lock/rosters/caster-json-schema/downloadableSources";

import { JSONSchemaType } from "ajv";

import { RosterLockV1MediaOverrideInfo } from "@roster-lock/types";

import { buildIdentity } from "../shared";

// Standalone file shipped alongside an override's asset folder - authored
// before the override has a computed content hash, so this only covers what
// an author can know up front (no engine context to cross-validate `assets`
// against, unlike mediaOverrideEntrySchema in lock/media-overrides).
export const mediaOverrideInfoFileSchema: JSONSchemaType<RosterLockV1MediaOverrideInfo> = {
  type: "object",
  required: ["configIdentity", "name", "assets", "downloadSources"],
  additionalProperties: false,
  properties: {
    configIdentity: buildIdentity("media-override-info", 1),

    name: { type: "string" },
    assets: {
      type: "array",
      items: { type: "string" },
    },
    downloadSources: downloadableSourcesSchema,
  },
}
