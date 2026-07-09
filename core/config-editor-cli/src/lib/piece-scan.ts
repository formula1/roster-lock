import { getAssetsOfFiles, collectAssetFileErrors, calculatePieceVersion } from "@roster-lock/shared";
import { RosterLockV1Config } from "@roster-lock/types";
import { walkRelative, getFileFromRoot } from "./fs-walk";

type PieceDefinition = RosterLockV1Config["engine"]["pieceDefinitions"][string];

export async function scanPieceFolder(
  folder: string,
  pathVariables: Record<string, string>,
  pieceDefinition: PieceDefinition,
){
  const assetInfo = await getAssetsOfFiles(walkRelative(folder), pathVariables, pieceDefinition);
  const errors = collectAssetFileErrors(assetInfo);
  const version = await calculatePieceVersion(
    assetInfo.filesWithAssets,
    (relativePath) => getFileFromRoot(folder, relativePath)
  );
  return { version, errors };
}
