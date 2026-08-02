import { JSONSchemaCaster } from "../../../util-types/json-schema";

import { RosterLockV1MediaOverrideInfo } from "@roster-lock/types";

import { mediaOverrideInfoFileKeywords } from "./keywords";

import { mediaOverrideInfoFileSchema } from "./schema";

export const ROSTERLOCK_V1_MEDIAOVERRIDEINFO_CASTER_JSONSCHEMA = new JSONSchemaCaster<RosterLockV1MediaOverrideInfo>(
  mediaOverrideInfoFileSchema,
  mediaOverrideInfoFileKeywords
);

export * from "./file-paths"
