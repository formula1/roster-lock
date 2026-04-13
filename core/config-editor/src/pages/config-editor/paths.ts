import { RosterLockV1Config } from "@roster-lock/types";

export const RosterLockConfigPaths = {
  newRoot: "/config/new" as const,
  newEngine: "/config/new/engine" as const,
  newEngineTest: "/config/new/engine/test" as const,
  newRoster: "/config/new/roster" as const,
  newSelection: "/config/new/selection" as const,

  fileRoot: "/config/:filePath" as const,
  fileEngine: "/config/:filePath/engine" as const,
  fileEngineTest: "/config/:filePath/engine/test" as const,
  fileRoster: "/config/:filePath/roster" as const,
  fileSelection: "/config/:filePath/selection" as const,
}

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
