import { findAllCycles, getCyclesUsingKey } from "../../../../../../utils/tree";
import { RosterLockV1Config } from "@roster-lock/types";
type RosterLockEngineConfig = RosterLockV1Config["engine"];


export class CycleError extends Error {
  constructor(public cycles: Array<Array<string>>){
    super(`Piece requirements form a cycle`);
  }
  getCyclesOfPiece(pieceType: string){
    return getCyclesUsingKey(pieceType, this.cycles);
  }
}

export function validatePieceRequirementCycles(engine: RosterLockEngineConfig){
  const pieceTypes = Object.keys(engine.pieceDefinitions);
  const cycles = findAllCycles(pieceTypes, (pieceType) => engine.pieceDefinitions[pieceType].requires);
  if(cycles.length > 0) throw new CycleError(cycles);
}

export function validatePieceInCycles(pieceType: string, engine: RosterLockEngineConfig){
  const pieceTypes = Object.keys(engine.pieceDefinitions);
  const cycles = findAllCycles(pieceTypes, (pieceType) => engine.pieceDefinitions[pieceType].requires);
  if(cycles.length === 0) return;
  const pieceCycles = getCyclesUsingKey(pieceType, cycles);
  if(pieceCycles.length === 0) return;
  throw new CycleError(pieceCycles);
}

export function validatePieceRequirementList(
  requires: Array<string>
){
  if(requires.length === 0) return;
  if(new Set(requires).size !== requires.length)
    throw new Error(`Duplicate requires`);
}

export function validatePieceRequirementIsResolved(
  requiredPieceType: RosterLockEngineConfig["pieceDefinitions"][string]["requires"][0],
  engine: RosterLockEngineConfig
){
  const requiredDefinition = engine.pieceDefinitions[requiredPieceType];
  if(!requiredDefinition){
    throw new Error(`Non-existant piece ${requiredPieceType} required`);
  }
  if(requiredDefinition.selectionStrategy !== "on demand"){
    throw new Error(`Non on-demand piece ${requiredPieceType} required`);
  }
}


// 
// This version tries to use the minimum amount of loops possible
// Ensure that pieces not on demand can't be required by another non on demand piece
// Ensure all on demand pieces are required by another piece
export function eachPieceRequirementIsResolved_COMPLEX(engine: RosterLockEngineConfig){
  const notOnDemandPieceTypes = new Set<string>();
  const unusedOnDemandPieceTypes = new Set<string>();
  const usedOnDemandPieceTypes = new Set<string>();
  const expectedRequires = new Set<string>();
  for(const [pieceType, definition] of Object.entries(engine.pieceDefinitions)){
    // If the piece is on demand, we don't need to resolve it
    if(definition.selectionStrategy === "on demand"){
      if(usedOnDemandPieceTypes.has(pieceType)) continue;
      expectedRequires.delete(pieceType);
      unusedOnDemandPieceTypes.add(pieceType);

      if(definition.requires.length === 0) continue;
      if(new Set(definition.requires).size !== definition.requires.length)
        throw new Error(`Piece ${pieceType} has duplicate requires`);
      continue;
    }

    // If the piece is not on demand, It can't be required
    if(expectedRequires.has(pieceType)){
      throw new Error(`Piece ${pieceType} is required by another piece but is not an on demand piece`);
    }
    notOnDemandPieceTypes.add(pieceType);

    // If we have no requirements, we're done
    if(definition.requires.length === 0) continue;
    if(new Set(definition.requires).size !== definition.requires.length)
      throw new Error(`Piece ${pieceType} has duplicate requires`);

    checkRequires(pieceType, definition);
  }

  if(expectedRequires.size > 0){
    throw new Error(`The following pieces are required but not resolved: ${Array.from(expectedRequires).join(", ")}`);
  }

  function checkRequires(pieceType: string, definition: RosterLockEngineConfig["pieceDefinitions"][string]){

    // Check each required piece type
    for(const requiredPieceType of definition.requires){
      // If the required piece type was already resolved, we're ok
      if(notOnDemandPieceTypes.has(requiredPieceType)){
        throw new Error(`Piece ${requiredPieceType} is required by another piece but is not an on demand piece`);
      }

      // If the required piece type was already used, we're ok
      if(usedOnDemandPieceTypes.has(requiredPieceType)) continue;

      // If the required piece type is on demand but wasn't used, we need to resolve it
      if(unusedOnDemandPieceTypes.has(requiredPieceType)){
        unusedOnDemandPieceTypes.delete(requiredPieceType);
        usedOnDemandPieceTypes.add(requiredPieceType);
        checkRequires(requiredPieceType, engine.pieceDefinitions[requiredPieceType]);
        continue;
      }

      // Otherwise the on demand piece is not defined yet, we expect to find it later
      expectedRequires.add(requiredPieceType);
    }
  }
}

