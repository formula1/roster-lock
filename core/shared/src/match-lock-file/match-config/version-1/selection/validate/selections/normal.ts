import { RosterLockV1Config } from "../../../types";
import { SelectionNormalConfig } from "../../types";
import { PieceType } from "../../types/shared";

export function validateNormal(
  selection: SelectionNormalConfig,
  pieceType: PieceType,
  config: RosterLockV1Config
){
  validateRequiredProperties(selection, pieceType, config);

  if("validation" in selection && selection.validation){
    validateSelection(selection.validation, pieceType, config);
  }
}

function validateRequiredProperties(
  selection: SelectionNormalConfig,
  pieceType: PieceType,
  config: RosterLockV1Config
){
  const pieceDefinition = config.engine.pieceDefinitions[pieceType];
  if(pieceDefinition.selectionStrategy === "on demand"){
    if("validation" in selection && selection.validation){
      throw new Error(`On demand piece ${pieceType} cannot have validation`);
    }
    if("mergeAlgorithm" in selection && selection.mergeAlgorithm){
      throw new Error(`On demand piece ${pieceType} cannot have a merge algorithm`);
    }
    return;
  }

  if(pieceDefinition.selectionStrategy === "shared"){
    if(!("mergeAlgorithm" in selection && selection.mergeAlgorithm)){
      throw new Error(`Shared piece ${pieceType} must have a merge algorithm`);
    }
    return;
  }
}

type SelectionValidation = NonNullable<SelectionNormalConfig["validation"]>;

export function validateSelection(
  validation: SelectionValidation,
  pieceType: PieceType,
  config: RosterLockV1Config
){

  validateRange(validation.count);
  validateSelectionBanList(validation.banList || [], config.rosters[pieceType]);
}

export function validateRange(count: SelectionValidation["count"]){
  if(!Array.isArray(count)){
    if(count === "*") return;
    if(count < 0) throw new Error(`count should be greater than or equal to 0`);
    return;
  }
  if(count.length !== 2){
    throw new Error(`range should be a single value or a range of two values`);
  }
  if(count[0] < 0){
    throw new Error(`range should not have a negative minimum`);
  }
  if(count[1] === "*") return;
  if(count[0] >= count[1]){
    throw new Error(`maximum should be greater than the minimum`);
  }
}


export function validateSelectionBanList(
  banList: Array<string>,
  roster: RosterLockV1Config["rosters"][string]
){
  for(const pieceId of banList){
    if(!roster.find(p=>p.id === pieceId)){
      throw new Error(`Ban list contains piece ${pieceId} which does not exist`);
    }
  }
}
