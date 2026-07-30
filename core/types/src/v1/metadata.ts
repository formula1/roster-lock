
import { RosterLockPiece } from "./lock/roster";
import { RosterLockIdentity } from "./shared";

export type RosterLockV1PieceInfo = (
  & {
    configIdentity: RosterLockIdentity<"piece-info", 1>
  }
  & Pick<RosterLockPiece, "humanInfo" | "downloadSources" | "pathVariables">
)
