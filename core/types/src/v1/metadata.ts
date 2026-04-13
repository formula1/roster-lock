
import { RosterLockPiece } from "./lock/roster";

export type RosterLockV1PieceMetadata = (
  & {
    configPurpose: "piece-meta",
    configVersion: 1,
  }
  & Pick<RosterLockPiece, "humanInfo" | "downloadSources" | "pathVariables">
)
