
import { RosterLockV1Config, MediaOverrideEntry } from "@roster-lock/types";
import { validateSha256 } from "../../rosters/validate/utils";
import { validatePieceInEngine } from "../../rosters/validate";

export function validateMediaOverridePieceType(
  pieceType: string, engine: RosterLockV1Config["engine"]
){
  validatePieceInEngine(pieceType, engine);
}

export function validateMediaOverrideLogicHash(
  logicHash: string, pieceType: string, rosters: RosterLockV1Config["rosters"]
){
  validateSha256(logicHash);
  const roster = rosters[pieceType] ?? [];
  if(!roster.some((piece)=>piece.version.logic === logicHash)){
    throw new Error(`No piece of type ${pieceType} has logic hash ${logicHash}`);
  }
}

export function validateMediaOverrideAssets(
  assets: MediaOverrideEntry["assets"], pieceType: string, engine: RosterLockV1Config["engine"]
){
  if(assets.length === 0)
    throw new Error("Media override must declare at least one asset");
  const pieceDefinition = engine.pieceDefinitions[pieceType];
  if(!pieceDefinition)
    throw new Error(`Piece type ${pieceType} is not defined in engine`);

  const seen = new Set<string>();
  for(const assetName of assets){
    if(seen.has(assetName))
      throw new Error(`Duplicate asset ${assetName} in media override`);
    seen.add(assetName);

    const asset = pieceDefinition.assets.find((a)=>a.name === assetName);
    if(!asset)
      throw new Error(`Asset ${assetName} is not defined for piece type ${pieceType}`);
    if(asset.classification !== "media")
      throw new Error(
        `Asset ${assetName} has classification "${asset.classification}" - media overrides can only reference "media" assets`
      );
  }
}
