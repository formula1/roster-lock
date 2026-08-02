import { getAssetsOfFilesForOverride, calculateMediaOverrideVersion } from "@roster-lock/shared";
import { RosterLockV1Config } from "@roster-lock/types";
import { walkRelative, getFileFromRoot } from "./fs-walk";

type PieceDefinition = RosterLockV1Config["engine"]["pieceDefinitions"][string];

export async function scanMediaOverrideFolder(
  folder: string,
  pathVariables: Record<string, string>,
  pieceDefinition: PieceDefinition,
  assetNames: Array<string>,
){
  const { filesWithAssets, errors } = await getAssetsOfFilesForOverride(
    walkRelative(folder), pathVariables, pieceDefinition, new Set(assetNames)
  );
  const hash = await calculateMediaOverrideVersion(
    filesWithAssets, (relativePath) => getFileFromRoot(folder, relativePath)
  );
  return { hash, errors };
}
