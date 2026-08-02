
import { RosterLockPiece } from "./lock/roster";
import { MediaOverrideEntry } from "./lock/media-override";
import { RosterLockIdentity } from "./shared";

export type RosterLockV1PieceInfo = (
  & {
    configIdentity: RosterLockIdentity<"piece-info", 1>
  }
  & Pick<RosterLockPiece, "humanInfo" | "downloadSources" | "pathVariables">
)

export type RosterLockV1MediaOverrideInfo = (
  & { configIdentity: RosterLockIdentity<"media-override-info", 1> }
  & MediaOverrideEntry
)
