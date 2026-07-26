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

type Paths = { [key: string]: string | Paths }

export function addPrefixToPaths(prefix: string){
  if(!prefix.startsWith("/")){
    throw new Error("URL prefix should be based on root")
  }
  if(prefix.endsWith("/")){
    prefix = prefix.slice(0, -1)
  }

  return addPrefixToPathsRecursive(RosterLockPaths);

  function addPrefixToPathsRecursive(paths: Paths){
    const result: Paths = {};
    for(const [key, path] of Object.keys(paths)){
      if(typeof path === "string") result[key] = prefix + path;
      else result[key] = addPrefixToPathsRecursive(path);
    }
    return result;
  }
}

// Rooted under /config so a host can keep its own pages (home/file picking,
// about, settings, ...) on sibling paths.
export const RosterLockPaths = {
  Root: "/" as const,
  Engine: "/engine" as const,
  EngineTest: "/engine/test" as const,
  Roster: "/roster" as const,
  Selection: {
    INDEX: "/selection" as const,
    GlobalValidation: "/selection/global-validation" as const,
    PieceSelection: "/selection/piece/:pieceType" as const,
    ScriptDictionary: {
      INDEX: "/selection/dictionary" as const,
      Docs: "/selection/dictionary/script-docs" as const,
      AddScripts: "/selection/dictionary/add-scripts" as const,
      AvailableScripts: "/selection/dictionary/available-scripts" as const,
      RunScript: "/selection/dictionary/run-script" as const,
    },
  }
}
