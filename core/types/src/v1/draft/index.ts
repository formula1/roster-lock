
import { RosterLockPiece } from "../lock/roster";
import { RosterLockV1Config } from "../lock";

type DownloadableSource = string;

type RosterLockDraftPieceInfo = {
  referenceFolder?: string,
  testedDownloadSources: Array<{
    source: DownloadableSource,
    testedAt: string,
    version: { logic: string, media: string, docs: string }
  }>,
}

type RosterLockDraftPiece = (
  & RosterLockPiece
  & { draftInfo: RosterLockDraftPieceInfo }
)

type RosterLockDraftConfig = (
  & Omit<RosterLockV1Config, "rosters">
  & { rosters: Record<string, Array<RosterLockDraftPiece>> }
)

export type RosterLockV1Draft = {
  configPurpose: "draft",
  configVersion: 1,
  previousVersion: string,
  previousLock?: RosterLockV1Config,
  stagedLock: RosterLockDraftConfig,
}
