
import { RosterLockV1Config, PieceType, SelectedPiece } from "@roster-lock/types";

export function ensurePiecesAreInRoster(
  config: RosterLockV1Config,
  pieceType: PieceType,
  selections: Array<SelectedPiece>
){
  const requireConfig = new Set(config.engine.pieceDefinitions[pieceType].requires);
  if(requireConfig.size !== config.engine.pieceDefinitions[pieceType].requires.length){
    throw new Error(`${pieceType} requires has duplicate items`);
  }
  const roster = config.rosters[pieceType];
  for(const piece of selections){
    const rosterPiece = roster.find(p=>p.id === piece.id);
    if(!rosterPiece){
      throw new Error(`Piece ${piece.id} is not in the roster`);
    }
    const pieceRequiredKeys = Object.keys(piece.required);
    if(pieceRequiredKeys.length !== requireConfig.size){
      throw new Error(`Piece ${piece.id} has incorrect number of required keys`);
    }
    for(const requirePieceType of pieceRequiredKeys){
      if(!requireConfig.has(requirePieceType)){
        throw new Error(`Piece ${piece.id} is missing required piece type ${requirePieceType}`);
      }
      ensureCorrectMandatory(rosterPiece, requirePieceType, piece.required[requirePieceType].mandatory);
      ensurePiecesAreInRoster(config, requirePieceType, piece.required[requirePieceType].mandatory);
      ensureSelectionIsAllowed(rosterPiece, requirePieceType, piece.required[requirePieceType].selectable);
      ensurePiecesAreInRoster(config, requirePieceType, piece.required[requirePieceType].selectable);
    }
  }
}

type RosterPiece = RosterLockV1Config["rosters"][string][number];
function ensureCorrectMandatory(
  rosterPiece: RosterPiece, requiredPieceType: string, mandatoryPieces: Array<SelectedPiece>
){
  const rosterMandatory = rosterPiece.requiredPieces[requiredPieceType];
  if(!rosterMandatory) throw new Error(`Roster Piece ${rosterPiece.id} missing required ${requiredPieceType}`);
  if(rosterMandatory.expected.length !== mandatoryPieces.length){
    throw new Error(`Piece ${rosterPiece.id} has incorrect number of required pieces for ${requiredPieceType}`);
  }
  for(let i = 0; i < rosterMandatory.expected.length; i++){
    const mandatoryId = rosterMandatory.expected[i];
    const mandatoryPiece = mandatoryPieces[i];
    if(mandatoryId !== mandatoryPiece.id){
      throw new Error(`Piece ${rosterPiece.id} has incorrect required piece of ${requiredPieceType} at ${i}`);
    }
  }
}

function ensureSelectionIsAllowed(
  rosterPiece: RosterPiece, requiredPieceType: string, selectedPieces: Array<SelectedPiece>
){
  const rosterMandatory = rosterPiece.requiredPieces[requiredPieceType];
  if(!rosterMandatory) throw new Error(`Roster Piece ${rosterPiece.id} missing required ${requiredPieceType}`);
  if(!rosterMandatory.selectable && selectedPieces.length > 0){
    throw new Error(`Piece ${rosterPiece.id} does not allow custom selection for ${requiredPieceType}`);
  }
}
