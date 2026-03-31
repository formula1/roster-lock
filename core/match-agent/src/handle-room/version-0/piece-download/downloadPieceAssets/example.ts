import { MatchLockPublishPiece } from "@match-lock/shared";
import { downloadPieceAssets } from "./index";

/**
 * Example usage of the new asset-based download system
 */
export async function exampleDownload() {
  // Example piece with individual assets
  const examplePiece: MatchLockPublishPiece = {
    name: "example-character",
    author: "game-dev",
    published: "2024-01-01T00:00:00Z",
    sha256: "abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234",
    signature: "example-signature",
    signatureVerificationUrl: "https://example.com/verify",
    preview: {
      image: "https://example.com/preview.jpg",
      url: "https://example.com/preview"
    },
    sources: [
      {
        type: "http",
        url: "https://example.com/assets/"
      }
    ],
    pieceDefinition: "character",
    version: {
      logic: "logic-sha256-hash-here",
      media: "media-sha256-hash-here"
    },
    assets: {
      "character.json": {
        assetType: "json",
        sha256: "file1-sha256-hash-here",
        sizeBytes: 1024
      },
      "sprites/idle.png": {
        assetType: "png", 
        sha256: "file2-sha256-hash-here",
        sizeBytes: 2048
      },
      "sounds/jump.wav": {
        assetType: "wav",
        sha256: "file3-sha256-hash-here", 
        sizeBytes: 4096
      }
    }
  };

  const targetDirectory = "./downloaded-pieces";
  
  try {
    const pieceFolder = await downloadPieceAssets(
      examplePiece,
      targetDirectory,
      (progress) => {
        console.log(`Download progress for ${progress.pieceId}:`);
        console.log(`  Completed: ${progress.completedAssets}/${progress.totalAssets}`);
        if (progress.currentAsset) {
          console.log(`  Current: ${progress.currentAsset.filePath} (${Math.round(progress.currentAsset.progress * 100)}%)`);
        }
      }
    );
    
    console.log(`Successfully downloaded piece to: ${pieceFolder}`);
    
    // The downloaded structure will be:
    // ./downloaded-pieces/game-dev/example-character-logic-sh/
    // ├── character.json
    // ├── sprites/
    // │   └── idle.png  
    // ├── sounds/
    // │   └── jump.wav
    // └── piece.matchlock.json (metadata)
    
    return pieceFolder;
    
  } catch (error) {
    console.error("Download failed:", error);
    throw error;
  }
}

/**
 * Example of downloading a single asset
 */
export async function exampleSingleAssetDownload() {
  const { downloadSingleAsset } = await import("./downloadSingleAsset");
  
  const examplePiece: MatchLockPublishPiece = {
    // ... same as above
  } as any;
  
  try {
    const result = await downloadSingleAsset({
      piece: examplePiece,
      filePath: "character.json",
      asset: {
        assetType: "json",
        sha256: "file1-sha256-hash-here",
        sizeBytes: 1024
      },
      targetDirectory: "./single-asset-test",
      onProgress: (progress) => {
        console.log(`Downloading ${progress.filePath}: ${Math.round(progress.progress * 100)}%`);
      }
    });
    
    console.log(`Downloaded ${result.filePath} to ${result.localPath}`);
    return result;
    
  } catch (error) {
    console.error("Single asset download failed:", error);
    throw error;
  }
}
