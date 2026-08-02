import { RosterLockV1Config, RosterLockV1Draft } from "@roster-lock/types";
import { cloneJSON } from "@roster-lock/utils";

export const EMPTY_ROSTER_LOCK: RosterLockV1Config = {
  configIdentity: { namespace: "roster-lock", purpose: "lock", version: 1 },
  author: "",
  title: "",
  version: "0.0.0",
  engine: { name: "", version: "", pieceDefinitions: {} },
  rosters: {},
  mediaOverrides: {},
  selection: { piece: {}, globalValidation: [], scriptDictionary: {}, },
  pieceMeta: {},
}

export const EMPTY_ROSTER_DRAFT: RosterLockV1Draft = {
  configIdentity: { namespace: "roster-lock", purpose: "draft", version: 1 },
  previousLock: cloneJSON(EMPTY_ROSTER_LOCK),
  stagedLock: cloneJSON(EMPTY_ROSTER_LOCK),
  draft: {
    rosterPieceInfo: {},
    mediaOverrideInfo: {},
    selectionScriptInfo: {},
  }
};

import {
  SelectionGameControlledConfig,
  SelectionNormalConfig,
  SelectionPreselectedConfig,
  SelectionUnselectableConfig,
  SelectionPieceMeta,
  JSONShallowObject,
} from "@roster-lock/types";
export const EMPTY_ROSTER_GAME_SELECTION: SelectionGameControlledConfig = {
  type: "game-controlled",
}

export const EMPTY_ROSTER_NORMAL_SELECTION: SelectionNormalConfig = {
  type: "normal",
  validation: {
    count: "*",
    unique: false,
    banList: [],
    customValidation: []
  },
  mergeAlgorithm: void 0
}

export const EMPTY_ROSTER_PRESELECTED_SELECTION: SelectionPreselectedConfig = {
  type: "preselected",
  pieces: []
}

export const EMPTY_ROSTER_UNSELECTABLE_SELECTION: SelectionUnselectableConfig = {
  type: "unselectable",
}

export const EMPTY_PIECE_META: SelectionPieceMeta<JSONShallowObject> = {
  schema: {},
  defaultMeta: {},
  values: {},
}
