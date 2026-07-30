import { RosterLockV1Config, RosterLockPiece } from "@roster-lock/types";
import z, { ZodType } from "zod";

import { CountSchema } from "./count";

export const engineCaster: ZodType<RosterLockV1Config["engine"]> = z.object({
  name: z.string(),
  version: z.string(),
  pieceDefinitions: z.record(z.string(), z.object({
      selectionStrategy: z.enum(["mandatory", "personal", "shared", "on demand"]),
      requires: z.array(z.string()),
      pathVariables: z.array(z.string()),
      assets: z.array(z.object({
        name: z.string(),
        classification: z.enum(["logic", "media", "doc"]),
        count: CountSchema,
        glob: z.array(z.string()),
      })),
  })),
})

const pieceObjectCaster = z.object({
  id: z.string(),
  version: z.object({
    logic: z.string(),
    media: z.string(),
    docs: z.string(),
  }),
  humanInfo: z.object({
    name: z.string(),
    author: z.string(),
    url: z.string(),
    image: z.string().optional(),
  }),
  downloadSources: z.array(z.string()),
  pathVariables: z.record(z.string(), z.string()),
  requiredPieces: z.record(z.string(), z.object({
      expected: z.array(z.string()),
      selectable: z.boolean(),
  })),
})

export const pieceCaster: ZodType<RosterLockPiece> = pieceObjectCaster;

// Piece file routes only resolve a piece's on-disk folder (by content hash +
// pathVariables), so they don't need the rest of RosterLockPiece.
export const pieceFileInfoCaster = pieceObjectCaster.pick({ version: true, pathVariables: true });