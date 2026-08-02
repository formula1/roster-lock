import { RosterLockIdentity, LogicId, Sha256, PieceType } from "../shared";
import { RosterLockEngineConfig } from "./engine";
import { RosterLockPiece } from "./roster";
import { RosterLockSelectionConfig } from "./selection";
import { RosterLockPieceMeta } from "./piece-meta";
import { MediaOverrideEntry } from "./media-override";

export * from "./engine";
export * from "./roster";
export * from "./selection";
export * from "./piece-meta";
export * from "./media-override";


export type RosterLockV1Config = {
  configIdentity: RosterLockIdentity<"lock", 1>,

  author: string,
  title: string,
  version: string,
  engine: RosterLockEngineConfig,
  rosters: Record<string, Array<RosterLockPiece>>,
  // Record<PieceType, Record<LogicId, Record<OverrideHash, MediaOverrideEntry>>> -
  // an override is declared against a piece's stable logic identity (see LogicId),
  // not a specific roster piece entry, so it keeps applying across media/docs
  // revisions of "the same" piece. Optional - most configs have no skins to offer,
  // and shouldn't need to carry an empty map around to say so.
  mediaOverrides?: Record<PieceType, Record<LogicId, Record<Sha256, MediaOverrideEntry>>>,
  selection: RosterLockSelectionConfig,
  pieceMeta: RosterLockPieceMeta,
}

