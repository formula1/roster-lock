
import {
  type EnginePieceDefinition,
  type EngineAssetDefinition,
  type FileTestResult,
} from "./types"


export type CountViolation = { assetName: string; count: number; violation: null | string };

/**
 * Validate count restrictions for assets
 */
export function validateAssetCounts(
  results: FileTestResult[],
  pieceDefinition: EnginePieceDefinition
){
  const violations: CountViolation[] = [];
  const assetCounts = new Map<string, number>();
  
  // Count files for each asset type
  for (const result of results) {
    if (result.matchedAssets.length > 0) {
      const matchedAsset = result.matchedAssets[0];
      assetCounts.set(matchedAsset.name, (assetCounts.get(matchedAsset.name) || 0) + 1);
    }
  }
  
  // Check each asset definition's count requirements
  for (const asset of pieceDefinition.assets) {
    const count = assetCounts.get(asset.name) || 0;
    const violation = validateSingleAssetCount(asset, count);
    if (violation) {
      violations.push({ assetName: asset.name, count, violation });
    }
  }
  
  return violations;
}

export function updateViolations(violations: Record<string, CountViolation>, result: FileTestResult){
  if(result.matchedAssets.length === 0) return violations
  const matchedAsset = result.matchedAssets[0];
  const violation = (
    violations[matchedAsset.name] ||
    (violations[matchedAsset.name] = { assetName: matchedAsset.name, count: 0, violation: null })
  );
  violation.count++;
  violation.violation = validateSingleAssetCount(matchedAsset, violation.count);
  return { ...violations };
}

export function updateEmptyViolations(
  violations: Record<string, CountViolation>,
  pieceDefinition: EnginePieceDefinition
){
  const updated = { ...violations };
  for (const asset of pieceDefinition.assets) {
    if(updated[asset.name]) continue;
    updated[asset.name] = {
      assetName: asset.name, count: 0, violation: validateSingleAssetCount(asset, 0)
    };
  }
  return updated;
}

/**
 * Validate count for a single asset
 */
function validateSingleAssetCount(
  asset: EngineAssetDefinition,
  actualCount: number
): string | null {
  const { count } = asset;
  
  if (count === "*") {
    // Any count is valid
    return null;
  }
  
  if (typeof count === "number") {
    // Exact count required
    if (actualCount !== count) {
      return `expected exactly ${count}, got ${actualCount}`;
    }
    return null;
  }
  
  // Range count [min, max]
  const [min, max] = count;
  
  if (actualCount < min) {
    return `expected at least ${min}, got ${actualCount}`;
  }
  
  if (max !== "*" && actualCount > max) {
    return `expected at most ${max}, got ${actualCount}`;
  }
  
  return null;
}
