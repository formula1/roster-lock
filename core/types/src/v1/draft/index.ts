
import { RosterLockV1Config } from "../lock";
import { PieceId, PieceType, RosterLockIdentity } from "../shared";

type DownloadableSource = string;

type RosterLockDraftPieceInfo = {
  referenceFolder?: string,
  testedDownloadSources: Array<{
    source: DownloadableSource,
    testedAt: string,
    version: { logic: string, media: string, docs: string }
  }>,
}

export type RosterLockV1Draft = {
  configIdentity: RosterLockIdentity<"draft", 1>,
  previousLock: RosterLockV1Config,
  stagedLock: RosterLockV1Config,
  draftPieceInfo: Record<PieceType, Record<PieceId, RosterLockDraftPieceInfo>>
}
