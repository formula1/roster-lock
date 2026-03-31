import { SelectionNormalConfig } from "../../../../selection/types";
import { RosterLockV1Config } from "../../../../types";
import { ensurePiecesAreInRoster } from "../../ensure-pieces-are-in-roster";
import { PieceType, PieceId, SelectedPiece } from "../../types/selection";


export async function validateUserSelection(
  config: RosterLockV1Config,
  pieceType: PieceType,
  userSelections: Array<SelectedPiece>,
  selectionConfig: SelectionNormalConfig,
){

  ensurePiecesAreInRoster(config, pieceType, userSelections);

  if(!selectionConfig.validation) return;

  validateCount(selectionConfig.validation.count, userSelections);
  const banList = selectionConfig.validation.banList || [];
  const viewed = new Set<PieceId>();
  for(const piece of userSelections){
    if(banList.includes(piece.id)){
      throw new Error(`Banned piece ${piece.id} selected for ${pieceType}`);
    }
    if(selectionConfig.validation.unique){
      if(viewed.has(piece.id)){
        throw new Error(`Duplicate piece ${piece.id} selected for ${pieceType}`);
      }
      viewed.add(piece.id);
    }
  }
}

function validateCount(
  countConfig: NonNullable<SelectionNormalConfig["validation"]>["count"],
  userSelections: Array<SelectedPiece>
){
  if(!Array.isArray(countConfig)){
    if(countConfig === "*") return;
    if(userSelections.length !== countConfig){
      throw new Error(`Expected ${countConfig} pieces, got ${userSelections.length}`);
    }
    return;
  }
  const [min, max] = countConfig;
  if(userSelections.length < min){
    throw new Error(`Expected at least ${min} pieces, got ${userSelections.length}`);
  }
  if(max === "*") return;
  if(userSelections.length > max){
    throw new Error(`Expected at most ${max} pieces, got ${userSelections.length}`);
  }
}
