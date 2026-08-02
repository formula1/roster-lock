
import { RosterLockV1Config } from "../lock";
import { PieceId, PieceType, RosterLockIdentity, LogicId, Sha256 } from "../shared";

type DownloadableSource = string;

type RosterLockDraftPieceInfo = {
  referenceFolder?: string,
  testedDownloadSources: Array<{
    source: DownloadableSource,
    testedAt: number,
    version: { logic: string, media: string, docs: string }
  }>,
};

// A media override has one content hash, not a {logic,media,docs} triple.
type RosterLockDraftMediaOverrideInfo = {
  referenceFolder?: string,
  testedDownloadSources: Array<{
    source: DownloadableSource,
    testedAt: number,
    hash: Sha256,
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
    // Optional for the same reason RosterLockV1Config.mediaOverrides is - most
    // drafts author no skins, and pre-existing drafts shouldn't need migrating.
    mediaOverrideInfo?: Record<PieceType, Record<LogicId, Record<Sha256, RosterLockDraftMediaOverrideInfo>>>,
    selectionScriptInfo: Record<RelativePath, RosterLockDraftScriptInfo>
  }
};
