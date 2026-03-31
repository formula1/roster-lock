import { RosterLockV1Config, PieceType, ScriptPurposeInput } from "@match-lock/shared";
import { MultiSeedPRNG } from "./random";
import { AvailablePieces } from "./available-pieces";
import { createPieceMetaGetter } from "./get-piece-meta";
import { RequiredModule } from "./require-script";

export type ScriptGlobals<ScriptModule> = {
  randomFloat: ()=>number,
  randomInt: (min: number, max: number)=>number,
  shuffleIndexes: (length: number, startOffset?: number)=>Array<number>,
  getPieceMeta: (pieceType: string, pieceId: string)=>any,
  getAvailablePieces: (pieceType: string)=>Array<string>,
  requireScript: (path: string, runCode: (newPath: string, content: string)=>Promise<ScriptModule>)=>Promise<ScriptModule>,
}


export function getScriptGlobals<ScriptModule>(
  config: RosterLockV1Config,
  currentScriptPath: string,
  randomSeeds: string[],
  scripts: Record<string, string>,
  purpose: ScriptPurposeInput,
): ScriptGlobals<ScriptModule> {
  const availablePieces = new AvailablePieces(config);
  const { pieceType, seeds } = (()=>{
    if(purpose.type === "piece-user-validation"){
      return {
        pieceType: purpose.pieceType,
        seeds: ["validation", purpose.pieceType, purpose.userId],
      }
    }
    if(purpose.type === "piece-merge"){
      return {
        pieceType: purpose.pieceType,
        seeds: ["merge", purpose.pieceType],
      }
    }
    if(purpose.type === "global-validation"){
      return {
        pieceType: undefined,
        seeds: ["global-validation"],
      }
    }
    throw new Error("Unknown Purpose");
  })();
  const allowedPieces = getAllowedPieces(config, pieceType);
  randomSeeds.sort();
  const rng = new MultiSeedPRNG(seeds.concat(randomSeeds))
  const requiredModule = new RequiredModule<ScriptModule>(scripts, currentScriptPath);
  return {
    randomFloat: ()=>rng.nextFloat(),
    randomInt: (min: number, max: number)=>rng.nextInt(min, max),
    shuffleIndexes: (length: number, startOffset: number = 0)=>rng.shuffleIndexes(length, startOffset),
    getPieceMeta: createPieceMetaGetter(config, allowedPieces),
    getAvailablePieces: (p: PieceType)=>{
      if(!allowedPieces.has(p)) return [];
      return availablePieces.get(p);
    },
    requireScript: (path: string, runCode: (newPath: string, content: string)=>Promise<ScriptModule>)=>{
      return requiredModule.require(path, runCode);
    }
  }
}

/*
  We can make it so that in a script, the writer only has access to relevent piece meta
  For example, if a piece type requires another piece type, the writer has access to both piece types
  If a piece type doesn't require another piece type, the writer does not have access to that piece type's meta

  This may be overkill but we can do it for now
  */

function getAllowedPieces(
  config: RosterLockV1Config,
  pieceType?: PieceType,
){
  if(pieceType) return getAllowedPiecesAndRequired(config, pieceType)
  const allowedPieces = new Set<PieceType>();
  for(const pieceType of Object.keys(config.engine.pieceDefinitions)){
    allowedPieces.add(pieceType);
  }
  return allowedPieces;
}

function getAllowedPiecesAndRequired(
  config: RosterLockV1Config,
  pieceType: PieceType,
  allowedPieces: Set<PieceType> = new Set()
){
  allowedPieces.add(pieceType);
  const pieceDefinition = config.engine.pieceDefinitions[pieceType];
  for(const requiredPieceType of pieceDefinition.requires){
    getAllowedPiecesAndRequired(config, requiredPieceType, allowedPieces);
  }
  return allowedPieces;
}
