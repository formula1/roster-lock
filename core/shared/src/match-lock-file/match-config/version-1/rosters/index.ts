import { JSONSchemaCaster } from "../../../util-types/json-schema";

export * from "./validate";
export * from "./caster-json-schema";
export * from "./file-paths";

import { RosterLockV1PieceMetadata } from "@roster-lock/types";

import { rosterLockPieceMetadataSchema, rosterLockPieceMetadataKeywords } from "./caster-json-schema";

export const ROSTERLOCK_V1_PIECEMETADATA_CASTER_JSONSCHEMA = new JSONSchemaCaster<RosterLockV1PieceMetadata>(
  rosterLockPieceMetadataSchema,
  rosterLockPieceMetadataKeywords
)
