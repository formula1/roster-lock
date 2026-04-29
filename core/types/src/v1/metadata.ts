
import { RosterLockPiece } from "./lock/roster";
import { RosterLockIdentity } from "./shared";

export type RosterLockV1PieceMetadata = (
  & {
    configIdentity: RosterLockIdentity<"piece-meta", 1>
  }
  & Pick<RosterLockPiece, "humanInfo" | "downloadSources" | "pathVariables">
)
