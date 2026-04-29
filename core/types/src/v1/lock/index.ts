import { RosterLockIdentity } from "../shared";
import { RosterLockEngineConfig } from "./engine";
import { RosterLockPiece } from "./roster";
import { RosterLockSelectionConfig } from "./selection";

export * from "./engine";
export * from "./roster";
export * from "./selection";


export type RosterLockV1Config = {
  configIdentity: RosterLockIdentity<"lock", 1>,

  author: string,
  title: string,
  version: string,
  engine: RosterLockEngineConfig,
  rosters: Record<string, Array<RosterLockPiece>>,
  selection: RosterLockSelectionConfig,
}

