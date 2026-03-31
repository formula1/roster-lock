import { RosterLockV1Config } from "../../../../types";
import { PieceType, SelectedPiece } from "../../types/selection";

export function includeMandatoryRequire(
  config: RosterLockV1Config,
  pieceType: PieceType,
  selection: SelectedPiece
){
  const pieceDef = config.engine.pieceDefinitions[pieceType];
  const piece = config.rosters[pieceType].find(p=>p.id === selection.id);
  if(!piece){
    throw new Error(`Piece ${selection.id} does not exist`);
  }

  for(const requirePieceType of pieceDef.requires){
    const requiredPieceConfig = piece.requiredPieces[requirePieceType];
    if(!requiredPieceConfig){
      throw new Error(`Piece ${selection.id} is missing required piece type ${requirePieceType}`);
    }
    const requiredSelection = (()=>{
      const found = selection.required[requirePieceType];
      if(found) return found;
      const newSelection: Array<SelectedPiece> = [];
      selection.required[requirePieceType] = newSelection;
      return newSelection;
    })();
    if(!requiredPieceConfig.selectable){
      for(const selected of requiredSelection){
        if(!requiredPieceConfig.expected.includes(selected.id)){
          throw new Error(`Piece ${selection.id} requires ${selected.id} but it is not selectable`);
        }
      }
    }
    for(const requiredPieceId of requiredPieceConfig.expected){
      const piece = requiredSelection.find(p=>p.id === requiredPieceId);
      if(piece){
        includeMandatoryRequire(config, requirePieceType, piece);
        continue;
      }
      const newPiece = { id: requiredPieceId, required: {} };
      includeMandatoryRequire(config, requirePieceType, newPiece);
      requiredSelection.push(newPiece);
    }
  }
}
