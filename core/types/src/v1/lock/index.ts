import { RosterLockEngineConfig } from "./engine";
import { RosterLockPiece } from "./roster";
import { RosterLockSelectionConfig } from "./selection";

export * from "./engine";
export * from "./roster";
export * from "./selection";


export type RosterLockV1Config = {
  version: 1,
  engine: RosterLockEngineConfig,
  rosters: Record<string, Array<RosterLockPiece>>,
  selection: RosterLockSelectionConfig,
}

