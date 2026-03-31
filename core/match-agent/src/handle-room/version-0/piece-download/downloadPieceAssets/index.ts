import { join as pathJoin } from "node:path";
import { mkdir as fsMkdir, writeFile as fsWriteFile } from "node:fs/promises";

import { MatchLockPublishPiece } from "@match-lock/shared";
import { downloadSingleAsset } from "./downloadSingleAsset";
import { validateAssetFile } from "./validateAsset";
import { 
  ProgressListener, 
  PieceDownloadProgress, 
  AssetDownloadResult 
} from "./types";

export async function downloadPieceAssets(
  piece: MatchLockPublishPiece,
  targetDirectory: string,
  onProgress?: ProgressListener
): Promise<string> {
  // Create piece-specific directory using author/name-logicSha pattern
  const logicShaShort = piece.version.logic.substring(0, 8);
  const pieceFolder = pathJoin(targetDirectory, piece.author, `${piece.name}-${logicShaShort}`);
  
  // Ensure piece directory exists
  await fsMkdir(pieceFolder, { recursive: true });
  
  // Check if piece is already downloaded and up to date
  if (await isPieceUpToDate(piece, pieceFolder)) {
    return pieceFolder;
  }
  
  const assetEntries = Object.entries(piece.assets);
  const totalAssets = assetEntries.length;
  let completedAssets = 0;
  const downloadResults: AssetDownloadResult[] = [];
  
  // Download each asset
  for (const [filePath, asset] of assetEntries) {
    const targetFilePath = pathJoin(pieceFolder, filePath);
    
    // Check if this specific asset is already downloaded and valid
    if (await validateAssetFile(targetFilePath, asset)) {
      completedAssets++;
      downloadResults.push({
        filePath,
        localPath: targetFilePath,
        asset
      });
      
      // Report progress
      if (onProgress) {
        onProgress({
          pieceId: piece.name,
          completedAssets,
          totalAssets
        });
      }
      continue;
    }
    
    // Download the asset
    try {
      const result = await downloadSingleAsset({
        piece,
        filePath,
        asset,
        targetDirectory: pieceFolder,
        onProgress: (assetProgress) => {
          if (onProgress) {
            onProgress({
              pieceId: piece.name,
              completedAssets,
              totalAssets,
              currentAsset: assetProgress
            });
          }
        }
      });
      
      downloadResults.push(result);
      completedAssets++;
      
      // Report completion of this asset
      if (onProgress) {
        onProgress({
          pieceId: piece.name,
          completedAssets,
          totalAssets
        });
      }
      
    } catch (error) {
      throw new Error(`Failed to download piece ${piece.name}: ${error}`);
    }
  }
  
  // Create piece metadata file
  await createPieceMetadata(piece, pieceFolder, downloadResults);
  
  return pieceFolder;
}

async function isPieceUpToDate(
  piece: MatchLockPublishPiece,
  pieceFolder: string
): Promise<boolean> {
  try {
    // Check if all assets exist and are valid
    for (const [filePath, asset] of Object.entries(piece.assets)) {
      const targetFilePath = pathJoin(pieceFolder, filePath);
      if (!(await validateAssetFile(targetFilePath, asset))) {
        return false;
      }
    }
    return true;
  } catch (error) {
    return false;
  }
}

async function createPieceMetadata(
  piece: MatchLockPublishPiece,
  pieceFolder: string,
  downloadResults: AssetDownloadResult[]
): Promise<void> {
  const metadata = {
    pieceId: piece.name,
    author: piece.author,
    version: piece.version,
    downloadedAt: new Date().toISOString(),
    assets: downloadResults.map(result => ({
      filePath: result.filePath,
      localPath: result.localPath,
      sha256: result.asset.sha256,
      sizeBytes: result.asset.sizeBytes,
      assetType: result.asset.assetType
    }))
  };
  
  const metadataPath = pathJoin(pieceFolder, "piece.matchlock.json");
  await fsWriteFile(metadataPath, JSON.stringify(metadata, null, 2), "utf8");
}

export * from "./types";
export { downloadSingleAsset } from "./downloadSingleAsset";
export { validateAssetFile } from "./validateAsset";
