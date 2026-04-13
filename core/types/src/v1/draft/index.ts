
import { RosterLockPiece } from "../lock/roster";
import { RosterLockEngineConfig } from "../lock/engine";
import { RosterLockSelectionConfig } from "../lock/selection";
import { RosterLockV1Config } from "../lock";

type DownloadableSource = string;

export type RosterLockDraftPieceInfo = {
  referenceFolder?: string,
  testedDownloadSources: Array<{
    source: DownloadableSource,
    testedAt: string,
    version: { logic: string, media: string, docs: string }
  }>,
}

export type RosterLockDraftPiece = RosterLockPiece & {
  draftInfo: RosterLockDraftPieceInfo,
}

export type RosterLockDraftConfig = {
  engine: RosterLockEngineConfig,
  rosters: Record<string, Array<RosterLockDraftPiece>>,
  selection: RosterLockSelectionConfig,
}

export type RosterLockV1Draft = {
  configPurpose: "draft",
  configVersion: 1,
  previousVersion: string,
  previousLock?: RosterLockV1Config,
  pendingLock: RosterLockDraftConfig,
}
