import { RosterLockV1Config } from "@roster-lock/types";

export const RosterLockConfigPaths = {
  newRoot: "/config/new",
  newEngine: "/config/new/engine",
  newEngineTest: "/config/new/engine/test",
  newRoster: "/config/new/roster",
  newSelection: "/config/new/selection",

  fileRoot: "/config/:filePath",
  fileEngine: "/config/:filePath/engine",
  fileEngineTest: "/config/:filePath/engine/test",
  fileRoster: "/config/:filePath/roster",
  fileSelection: "/config/:filePath/selection",
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
