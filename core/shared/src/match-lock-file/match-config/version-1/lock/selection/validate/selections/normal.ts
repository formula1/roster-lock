
import { RosterLockV1Config, SelectionNormalConfig, PieceType } from "@roster-lock/types";
import { validateUntrustedScript } from "../script";
import { validateCount } from "../../../../shared/count";

export function validateNormal(
  selection: SelectionNormalConfig,
  pieceType: PieceType,
  config: RosterLockV1Config
){
  validateRequiredProperties(selection, pieceType, config);

  if("validation" in selection && selection.validation){
    validateSelection(selection.validation, pieceType, config);
  }
  if(selection.mergeAlgorithm){
    validateUntrustedScript(selection.mergeAlgorithm, config);
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
  validateCount(validation.count);
  validateSelectionBanList(validation.banList || [], config.rosters[pieceType]);
  for(const script of validation.customValidation){
    validateUntrustedScript(script, config);
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
