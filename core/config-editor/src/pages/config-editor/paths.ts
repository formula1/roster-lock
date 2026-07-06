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
  selection: {
    pieceType: (pieceName: string) => `selection-piece-${pieceName}`,
  }
}

export const RosterLockPaths = {
  Root: "/config/:filePath" as const,
  Engine: "/config/:filePath/engine" as const,
  EngineTest: "/config/:filePath/engine/test" as const,
  Roster: "/config/:filePath/roster" as const,
  Selection: {
    INDEX: "/config/:filePath/selection" as const,
    GlobalValidation: "/config/:filePath/selection/global-validation" as const,
    PieceSelection: "/config/:filePath/selection/piece/:pieceType" as const,
    ScriptDictionary: {
      INDEX: "/config/:filePath/selection/dictionary" as const,
      Docs: "/config/:filePath/selection/dictionary/script-docs" as const,
      AddScripts: "/config/:filePath/selection/dictionary/add-scripts" as const,
      AvailableScripts: "/config/:filePath/selection/dictionary/available-scripts" as const,
      RunScript: "/config/:filePath/selection/dictionary/run-script" as const,
    },
  }
}
