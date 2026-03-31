
import { RosterLockPiece } from "./lock/roster";

export type RosterLockV1PieceMetadata = (
  & { rosterlockVersion: 1 }
  & Pick<RosterLockPiece, "humanInfo" | "downloadSources" | "pathVariables">
)
