
import { RosterLockV1Config } from "../lock";
import { PieceId, PieceType, RosterLockIdentity } from "../shared";

type DownloadableSource = string;

type RosterLockDraftPieceInfo = {
  referenceFolder?: string,
  testedDownloadSources: Array<{
    source: DownloadableSource,
    testedAt: number,
    version: { logic: string, media: string, docs: string }
  }>,
};

type RelativePath = string;

type RosterLockDraftScriptInfo = {
  lastLoad: number,
  sha: string,
  referencePath: string
};

export type RosterLockV1Draft = {
  configIdentity: RosterLockIdentity<"draft", 1>,
  previousLock: RosterLockV1Config,
  stagedLock: RosterLockV1Config,
  draft: {
    rosterPieceInfo: Record<PieceType, Record<PieceId, RosterLockDraftPieceInfo>>,
    selectionScriptInfo: Record<RelativePath, RosterLockDraftScriptInfo>
  }
};
