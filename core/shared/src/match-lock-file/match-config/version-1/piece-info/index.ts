import { JSONSchemaCaster } from "../../../util-types/json-schema";

import { RosterLockV1PieceInfo } from "@roster-lock/types";

import { rosterLockPieceInfoKeywords } from "./keywords";

import { rosterLockPieceInfoSchema } from "./schema";

export const ROSTERLOCK_V1_PIECEINFO_CASTER_JSONSCHEMA = new JSONSchemaCaster<RosterLockV1PieceInfo>(
  rosterLockPieceInfoSchema,
  rosterLockPieceInfoKeywords
);

export * from "./file-paths"
