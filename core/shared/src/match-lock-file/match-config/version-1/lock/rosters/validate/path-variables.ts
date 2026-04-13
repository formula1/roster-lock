import { RosterLockV1Config } from "@roster-lock/types";
import { PATH_VARIABLE_VALUE_VALIDATION } from "../../engine/validate/piece/assets/glob/pathvariables";
type RosterLockPiece = RosterLockV1Config["rosters"][string][number];

export function validateAllExpectedPathVariableNamesSet(
  pathVariableValues: RosterLockPiece["pathVariables"],
  pieceConfig: RosterLockV1Config["engine"]["pieceDefinitions"][string],
){
  for(const variableName of pieceConfig.pathVariables){
    if(!(variableName in pathVariableValues)){
      throw new Error(`Piece is missing value for path variable ${variableName}`);
    }
  }
}

export function validatePathVariableNameIsExpected(
  variableName: string,
  pieceConfig: RosterLockV1Config["engine"]["pieceDefinitions"][string],
){
  if(!pieceConfig.pathVariables.includes(variableName)){
    throw new Error(`Piece does not have path variable ${variableName}`);
  }
}

export function validatePathVariableValue(
  variableValue: string,
){
  if (variableValue.length < PATH_VARIABLE_VALUE_VALIDATION.minLength) {
    throw new Error(`Path variable value is too short`);
  }
  
  if (variableValue.length > PATH_VARIABLE_VALUE_VALIDATION.maxLength) {
    throw new Error(`Path variable value is too long`);
  }
  
  const charsetRegex = new RegExp(`^[${PATH_VARIABLE_VALUE_VALIDATION.charset}]+$`);
  if (!charsetRegex.test(variableValue)) {
    throw new Error(`Path variable value contains invalid characters`);
  }
}
