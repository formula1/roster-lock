
import {
  PieceType, Count, Sha256
} from "../shared";


export type RosterLockEngineConfig = {
  name: string,
  version: string,
  pieceDefinitions: Record<PieceType, {
    selectionStrategy: EngineSelectionStrategy,
    requires: Array<PieceType>
    pathVariables: Array<string>,
    assets: Array<EngineAssetDefinition>
  }>,
  /*
  Selection configs the engine's own UI/matchmaker knows how to drive (e.g. "3v3
  tag team" or "1v1"), identified by hash. `tag` lets the game match a hash to one
  of its hardcoded selection screens without hardcoding the hash itself - a config
  revision gets a new hash under the same tag, and old rooms keep resolving via
  their original entry. Informational only - custom selection configs outside this
  list are still valid, they just won't be offered by that UI.
  */
  officialSelections?: Array<{ tag: string, hash: Sha256 }>,
};

export type AssetClassification = "logic" | "media" | "doc";
export type EngineAssetDefinition = {
  name: string,
  classification: AssetClassification,
  count: Count
  glob: Array<string>,
};

export type EngineSelectionStrategy = (
  | "mandatory"
  | "personal"
  | "shared"
  | "on demand"
);
