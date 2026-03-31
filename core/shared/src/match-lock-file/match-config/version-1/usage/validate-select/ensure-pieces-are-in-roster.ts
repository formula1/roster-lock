import { RosterLockV1Config } from "../../types";

import { PieceType, SelectedPiece } from "./types/selection";

export function ensurePiecesAreInRoster(
  config: RosterLockV1Config,
  pieceType: PieceType,
  selections: Array<SelectedPiece>
){
  const requireConfig = config.engine.pieceDefinitions[pieceType].requires;
  const roster = config.rosters[pieceType];
  for(const piece of selections){
    if(!roster.find(p=>p.id === piece.id)){
      throw new Error(`Piece ${piece.id} is not in the roster`);
    }
    if(requireConfig.length === 0) continue;
    if(!piece.required){
      throw new Error(`Piece ${piece.id} is missing required pieces`);
    }

    const pieceRequiredKeys = Object.keys(piece.required);
    if(pieceRequiredKeys.length !== requireConfig.length){
      throw new Error(`Piece ${piece.id} has incorrect number of required pieces`);
    }
    for(const requirePieceType of requireConfig){
      if(!pieceRequiredKeys.includes(requirePieceType)){
        throw new Error(`Piece ${piece.id} is missing required piece type ${requirePieceType}`);
      }
      ensurePiecesAreInRoster(config, requirePieceType, piece.required[requirePieceType]);
    }
  }
}
