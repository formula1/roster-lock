import { RosterLockV1Config, RosterLockV1Draft } from "@roster-lock/types";
import { cloneJSON } from "@roster-lock/utils";

export const EMPTY_ROSTER_LOCK: RosterLockV1Config = {
  configIdentity: { namespace: "roster-lock", purpose: "lock", version: 1 },
  author: "",
  title: "",
  version: "0.0.0",
  engine: { name: "", version: "", pieceDefinitions: {} },
  rosters: {},
  selection: { piece: {} },
}

export const EMPTY_ROSTER_DRAFT: RosterLockV1Draft = {
  configIdentity: { namespace: "roster-lock", purpose: "draft", version: 1 },
  previousLock: cloneJSON(EMPTY_ROSTER_LOCK),
  stagedLock: cloneJSON(EMPTY_ROSTER_LOCK),
  draftPieceInfo: {}
};
