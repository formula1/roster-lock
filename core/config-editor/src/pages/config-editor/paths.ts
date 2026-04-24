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
