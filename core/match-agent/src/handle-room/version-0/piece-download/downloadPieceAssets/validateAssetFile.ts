import { createHash } from "node:crypto";
import { stat as fsStat, readFile as fsReadFile } from "node:fs/promises";
import { MatchLockAsset } from "@match-lock/shared";


export async function validateAssetFile(
  filePath: string,
  expectedAsset: MatchLockAsset
): Promise<boolean> {
  try {
    const stats = await fsStat(filePath);
    
    // Check file size
    if (stats.size !== expectedAsset.sizeBytes) {
      return false;
    }
    
    // Check SHA256 hash
    const fileBuffer = await fsReadFile(filePath);
    const hash = createHash("sha256").update(fileBuffer).digest("hex");
    
    return hash === expectedAsset.sha256;
  } catch (error) {
    return false;
  }
}

export async function calculateFileHash(filePath: string): Promise<string> {
  const fileBuffer = await fsReadFile(filePath);
  return createHash("sha256").update(fileBuffer).digest("hex");
}

export async function getFileSize(filePath: string): Promise<number> {
  const stats = await fsStat(filePath);
  return stats.size;
}

export function validateAssetIntegrity(
  actualSize: number,
  actualHash: string,
  expectedAsset: MatchLockAsset
): void {
  if (actualSize !== expectedAsset.sizeBytes) {
    throw new Error(
      `Asset size mismatch: expected ${expectedAsset.sizeBytes} bytes, got ${actualSize} bytes`
    );
  }
  
  if (actualHash !== expectedAsset.sha256) {
    throw new Error(
      `Asset hash mismatch: expected ${expectedAsset.sha256}, got ${actualHash}`
    );
  }
}
