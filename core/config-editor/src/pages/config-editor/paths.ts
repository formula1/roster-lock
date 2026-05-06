import { RosterLockV1Config } from "@roster-lock/types";

type AssetItem = RosterLockV1Config["engine"]["pieceDefinitions"][string]["assets"][number];
type RosterItem = RosterLockV1Config["rosters"][string][number];
export const CONFIG_ID_PATHS = {
  engine: {
    pieceId: (pieceName: string) => `engine-piece-${pieceName}`,
    assetId: (asset: AssetItem) => `engine-piece-asset-${asset.name}`,
  },
  roster: {
    pieceTypeId: (pieceName: string) => `roster-piece-${pieceName}`,
    pieceValueId: (value: RosterItem) => `roster-piece-value-${value.version.logic}-${value.version.media}-${value.version.docs}`,
  },
}

export const RosterLockPaths = {
  Root: "/config/:filePath" as const,
  Engine: "/config/:filePath/engine" as const,
  EngineTest: "/config/:filePath/engine/test" as const,
  Roster: "/config/:filePath/roster" as const,
  Selection: {
    INDEX: "/config/:filePath/selection" as const,
    ScriptDictionary: {
      INDEX: "/config/:filePath/selection/dictionary" as const,
      MergeFolder: "/config/:filePath/selection/dictionary/merge-folder" as const,
      CurrentFiles: "/config/:filePath/selection/dictionary/current-files" as const,
      RunScript: "/config/:filePath/selection/dictionary/run-script" as const,
    }
  }
}
