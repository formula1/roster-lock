import { createWriteStream } from "node:fs";
import { mkdir as fsMkdir, rm as fsRm } from "node:fs/promises";
import { join as pathJoin, dirname } from "node:path";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { createHash } from "node:crypto";

import { MatchLockResolvable } from "@match-lock/shared";
import { httpStream } from "../../tools/download-methods/http";
import { torrentStream } from "../../tools/download-methods/torrent";
import { validateAssetIntegrity } from "./validateAsset";
import { AssetDownloadOptions, AssetDownloadResult } from "./types";

// Direct resolvers without the MatchLockAssetBundle dependency
const RESOLVERS: Record<MatchLockResolvable["type"], any> = {
  http: httpStream,
  torrent: torrentStream,
  git: () => Promise.reject("Git download not implemented"),
};

async function resolveAssetStream(sources: MatchLockResolvable[]) {
  for (const source of sources) {
    try {
      const resolver = RESOLVERS[source.type];
      if (!resolver) throw new Error("Unknown Resolvable Type");
      const result = await resolver(source);
      return result;
    } catch (e) {
      console.log("Failed To Resolve", e);
    }
  }
  throw new Error("Failed To Resolve");
}

export async function downloadSingleAsset(
  options: AssetDownloadOptions
): Promise<AssetDownloadResult> {
  const { piece, filePath, asset, targetDirectory, onProgress } = options;

  // Create target file path preserving the original file extension
  const targetFilePath = pathJoin(targetDirectory, filePath);
  const targetDir = dirname(targetFilePath);

  // Ensure target directory exists
  await fsMkdir(targetDir, { recursive: true });

  try {
    // Get the download stream directly from piece sources
    const assetSource = await resolveAssetStream(piece.sources);

    // Create progress tracking and hash validation transform
    const progressTracker = new ProgressTracker(
      asset.sizeBytes,
      (bytesDownloaded, progress) => {
        if (onProgress) {
          onProgress({
            pieceId: piece.name, // Using name as ID for now
            filePath,
            bytesDownloaded,
            totalBytes: asset.sizeBytes,
            progress
          });
        }
      }
    );

    // Create write stream
    const writeStream = createWriteStream(targetFilePath);

    // Download directly without compression handling for now
    // Individual assets are expected to be uncompressed files
    await pipeline(
      assetSource.stream,
      progressTracker,
      writeStream
    );

    // Validate the downloaded file
    validateAssetIntegrity(
      progressTracker.totalBytes,
      progressTracker.hash,
      asset
    );

    return {
      filePath,
      localPath: targetFilePath,
      asset
    };

  } catch (error) {
    // Clean up on failure
    try {
      await fsRm(targetFilePath, { force: true });
    } catch (cleanupError) {
      console.warn("Failed to clean up file after download error:", cleanupError);
    }

    throw new Error(`Failed to download asset ${filePath}: ${error}`);
  }
}

class ProgressTracker extends Transform {
  private hasher = createHash("sha256");
  public hash = "";
  public totalBytes = 0;
  
  constructor(
    private expectedSize: number,
    private progressCallback: (bytesDownloaded: number, progress: number) => void
  ) {
    super({ readableObjectMode: false, writableObjectMode: false });
  }
  
  _transform(chunk: Buffer, encoding: string, callback: (err?: Error, data?: Buffer) => any) {
    this.totalBytes += chunk.length;
    this.hasher.update(chunk);
    
    const progress = this.totalBytes / this.expectedSize;
    this.progressCallback(this.totalBytes, Math.min(progress, 1));
    
    callback(undefined, chunk);
  }
  
  _flush(callback: (err?: Error, data?: Buffer) => any) {
    this.hash = this.hasher.digest("hex");
    callback();
  }
}
