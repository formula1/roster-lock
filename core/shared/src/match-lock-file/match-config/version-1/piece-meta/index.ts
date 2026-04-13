import { JSONSchemaCaster } from "../../../util-types/json-schema";

import { RosterLockV1PieceMetadata } from "@roster-lock/types";

import { rosterLockPieceMetadataKeywords } from "./keywords";

import { rosterLockPieceMetadataSchema } from "./schema";

export const ROSTERLOCK_V1_PIECEMETADATA_CASTER_JSONSCHEMA = new JSONSchemaCaster<RosterLockV1PieceMetadata>(
  rosterLockPieceMetadataSchema,
  rosterLockPieceMetadataKeywords
);

export * from "./file-paths"