import { FILES_TO_IGNORE } from "./constants";

import { getMatchingAssetsForFile } from "./getMatchingAsset";

import { PieceDefinition, EngineAssetDefinition } from "./types";

export { getMatchingAssetsForFile };

export async function getAssetsOfFiles(
  files: Iterable<string> | AsyncIterable<string>,
  pathVariables: Record<string, string>,
  pieceDefinition: PieceDefinition,
): Promise<{
  assetsWithFiles: Map<string, { asset: EngineAssetDefinition, files: Array<string> }>
  filesWithAssets: Map<string, { assets: Array<EngineAssetDefinition> }>
}>{
  const assetCounts = new Map<string, { files: Array<string>, asset: EngineAssetDefinition }>();
  const fileCounts = new Map<string, { assets: Array<EngineAssetDefinition> }>();
  for await (const filePath of files){
    if(FILES_TO_IGNORE.includes(filePath)) continue;

    const assetMatching = getMatchingAssetsForFile(pieceDefinition, pathVariables, filePath);
    const asset = assetMatching[0];
    if(!asset){
      // Error: File doesn't match any assets
      fileCounts.set(filePath, { assets: [] });
      continue;
    }
    if(assetMatching.length > 1){
      // Warning: File matches multiple assets
    }
    const currentCount = ((): { files: Array<string>, asset: EngineAssetDefinition } =>{
      const currentCount = assetCounts.get(asset.name);
      if(currentCount) return currentCount;
      const newCount = { files: [], asset: asset };
      assetCounts.set(asset.name, newCount);
      return newCount;
    })();

    currentCount.files.push(filePath);
    fileCounts.set(filePath, { assets: assetMatching });
  }

  for(const asset of pieceDefinition.assets){
    const currentCountInfo = assetCounts.get(asset.name);
    if(!currentCountInfo){
      // Error: Asset has no files
      assetCounts.set(asset.name, { files: [], asset });
    }
  }

  return { filesWithAssets: fileCounts, assetsWithFiles: assetCounts };
}

// Like getAssetsOfFiles, but scoped to a media override's declared asset
// names - a file resolving to an asset outside that set is an authoring
// error (this scanner has no notion of "not applicable to this scan"),
// rather than silently being included the way an unmatched file is.
export async function getAssetsOfFilesForOverride(
  files: Iterable<string> | AsyncIterable<string>,
  pathVariables: Record<string, string>,
  pieceDefinition: PieceDefinition,
  allowedAssetNames: Set<string>,
): Promise<{
  filesWithAssets: Map<string, { assets: Array<EngineAssetDefinition> }>
  errors: Array<{ type: "file", id: string, message: string }>
}>{
  const fileCounts = new Map<string, { assets: Array<EngineAssetDefinition> }>();
  const errors: Array<{ type: "file", id: string, message: string }> = [];
  for await (const filePath of files){
    if(FILES_TO_IGNORE.includes(filePath)) continue;

    const assetMatching = getMatchingAssetsForFile(pieceDefinition, pathVariables, filePath);
    const asset = assetMatching[0];
    if(!asset){
      errors.push({ type: "file", id: filePath, message: "File has no matching assets" });
      continue;
    }
    if(!allowedAssetNames.has(asset.name)){
      errors.push({
        type: "file", id: filePath,
        message: `File matches asset "${asset.name}", which this override does not declare`,
      });
      continue;
    }
    fileCounts.set(filePath, { assets: assetMatching });
  }
  return { filesWithAssets: fileCounts, errors };
}

import { isValidAssetFileCount, validateAssetFileCount } from "./validateAssetFileCount";
export function collectAssetFileErrors(
  { assetsWithFiles, filesWithAssets }: Awaited<ReturnType<typeof getAssetsOfFiles>>
){
  const errors: Array<{ type: "asset" | "file", id: string, message: string }> = [];
  for(const [assetName, { asset, files }] of assetsWithFiles){
    try {
      if(files.length === 0 && !isValidAssetFileCount(asset.count, 0)){
        errors.push({
          type: "asset",
          id: assetName,
          message: `Asset is expected to have files`,
        });
        continue;
      }
      validateAssetFileCount(asset.count, files.length);
    }catch(e){
      errors.push({
        type: "asset",
        id: assetName,
        message: (e as Error).message,
      });
    }
  }
  for(const [filePath, { assets }] of filesWithAssets){
    if(assets.length === 0) errors.push({
      type: "file",
      id: filePath,
      message: "File has no matching assets",
    });
  }
  return errors;
}

