import { RosterLockV1Config } from "@roster-lock/types";
type RosterLockEngineConfig = RosterLockV1Config["engine"];

export * from "./requirements";
export * from "./path-variables";
export * from "./assets";
import { validatePathVariableName, validatePathVariables } from "./path-variables";
import { validateAsset } from "./assets";
import {
  validatePieceInCycles, validatePieceRequirementList, validatePieceRequirementIsResolved
} from "./requirements";
import { ValidationErrorPath } from "../error";

export function validatePieceDefinition(
  pieceType: string, definition: RosterLockEngineConfig["pieceDefinitions"][string], engine: RosterLockEngineConfig
){
  validatePieceRequirementList(definition.requires);
  for(const requiredPieceType of definition.requires){
    validatePieceRequirementIsResolved(requiredPieceType, engine);
  }
  validatePathVariables(definition.pathVariables);
  for(const variable of definition.pathVariables){
    validatePathVariableName(variable);
  }
  for(const asset of definition.assets){
    try {
      validateAsset(asset, definition);
    }catch(e){
      const eTyped = ValidationErrorPath.convertError(e);
      eTyped.addPathPrefix(`assets/${asset.name}`);
      throw e;
    }
  }
  validatePieceInCycles(pieceType, engine);
}


