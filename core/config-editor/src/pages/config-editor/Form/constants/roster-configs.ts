import { RosterLockV1Config, RosterLockV1Draft } from "@roster-lock/types";
import { cloneJSON } from "@roster-lock/utils";

export const EMPTY_ROSTER_LOCK: RosterLockV1Config = {
  configIdentity: { namespace: "roster-lock", purpose: "lock", version: 1 },
  author: "",
  title: "",
  version: "0.0.0",
  engine: { name: "", version: "", pieceDefinitions: {} },
  rosters: {},
  selection: { piece: {}, globalValidation: [], scriptDictionary: {}, },
}

export const EMPTY_ROSTER_DRAFT: RosterLockV1Draft = {
  configIdentity: { namespace: "roster-lock", purpose: "draft", version: 1 },
  previousLock: cloneJSON(EMPTY_ROSTER_LOCK),
  stagedLock: cloneJSON(EMPTY_ROSTER_LOCK),
  draft: {
    rosterPieceInfo: {},
    selectionScriptInfo: {},
  }
};

import {
  SelectionGameControlledConfig,
  SelectionNormalConfig,
  SelectionPreselectedConfig,
  SelectionUnselectableConfig
} from "@roster-lock/types";
export const EMPTY_ROSTER_GAME_SELECTION: SelectionGameControlledConfig = {
  type: "game-controlled",
  pieceMeta: {
    schema: {},
    defaultMeta: {},
    pieceMeta: {}
  }
}

export const EMPTY_ROSTER_NORMAL_SELECTION: SelectionNormalConfig = {
  type: "normal",
  pieceMeta: {
    schema: {},
    defaultMeta: {},
    pieceMeta: {}
  },
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
  pieceMeta: {
    schema: {},
    defaultMeta: {},
    pieceMeta: {}
  },
  pieces: []
}

export const EMPTY_ROSTER_UNSELECTABLE_SELECTION: SelectionUnselectableConfig = {
  type: "unselectable",
  pieceMeta: {
    schema: {},
    defaultMeta: {},
    pieceMeta: {}
  },
}
