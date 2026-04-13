
import { RosterLockV1Config, SelectionPreselectedConfig, PieceType } from "@roster-lock/types";

const PRESELECTABLE_STRATEGIES = ["shared", "personal"];
export function validatePreselected(
  selections: SelectionPreselectedConfig["pieces"],
  pieceType: PieceType,
  config: RosterLockV1Config
){
  const { engine } = config;
  const defintion = engine.pieceDefinitions[pieceType];
  if(!PRESELECTABLE_STRATEGIES.includes(defintion.selectionStrategy)){
    throw new Error(`Piece type ${pieceType} is not preselectable`);
  }
  for(const piece of selections){
    validatePieceRequired(piece, pieceType, defintion, config);
  }
}

function validatePieceRequired(
  piece: SelectionPreselectedConfig["pieces"][0],
  pieceType: PieceType,
  definition: RosterLockV1Config["engine"]["pieceDefinitions"][string],
  config: RosterLockV1Config
){
  const { engine, rosters } = config;
  if(!rosters[pieceType].find(p=>p.id === piece.id)){
    throw new Error(`Preselected piece ${piece.id} does not exist`);
  }
  const pieceRequires = Object.keys(piece.required);
  if(definition.requires.length === 0){
    if(pieceRequires.length > 0){
      throw new Error(`Preselected piece ${piece.id} has required pieces but the piece definition does not require any piece types`);
    }
  }
  if(definition.requires.length !== pieceRequires.length){
    throw new Error("All preselected pieces must require expected pieces")
  }
  const requiredPieceTypes = new Set(definition.requires);
  for(const [requiredPieceType, requiredPieceIds] of Object.entries(piece.required)){
    if(!requiredPieceTypes.has(requiredPieceType)){
      throw new Error(`Preselected piece ${piece.id} requires piece type ${requiredPieceType} but the piece definition does not require it`);
    }
    requiredPieceTypes.delete(requiredPieceType);
    for(const requiredPiece of requiredPieceIds){
      const defintion = engine.pieceDefinitions[requiredPieceType];
      if(defintion.selectionStrategy !== "on demand"){
        throw new Error(`Preselected piece ${piece.id} requires piece ${requiredPiece.id} but it is not an on demand piece`);
      }
      validatePieceRequired(requiredPiece, requiredPieceType, defintion, config);
    }
  }
  if(requiredPieceTypes.size > 0){
    throw new Error(`Preselected piece ${piece.id} does not require piece types ${Array.from(requiredPieceTypes).join(", ")}`);
  }
}
