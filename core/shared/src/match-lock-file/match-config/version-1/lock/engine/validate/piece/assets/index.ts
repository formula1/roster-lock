import { RosterLockV1Config } from "@roster-lock/types";
type RosterLockEngineConfig = RosterLockV1Config["engine"];
type EngineAssetDefinition = RosterLockEngineConfig["pieceDefinitions"][string]["assets"][number];

import { validateCount } from "../../../../../shared/count";

export function validateAsset(
  pieceAssetDefinition: RosterLockEngineConfig["pieceDefinitions"][string]["assets"][0],
  definition: RosterLockEngineConfig["pieceDefinitions"][string]
){
  validateAssetName(pieceAssetDefinition.name, definition.assets);
  validateCount(pieceAssetDefinition.count);
  validateGlobList(pieceAssetDefinition.glob);
  for(const g of pieceAssetDefinition.glob){
    validatePathVariablesInGlob(g, definition.pathVariables);
    validateGlobItem(g);
  }
}

export function validateAssetName(
  name: EngineAssetDefinition["name"], assets: RosterLockEngineConfig["pieceDefinitions"][string]["assets"]
){
  if(name === ""){
    throw new Error("Name is empty");
  }
  if(name !== name.trim()){
    throw new Error("Name contains a trailing or leading space");
  }
  if(assets.filter((a) => a.name === name).length > 1){
    throw new Error("Duplicate name");
  }
}

import { validatePathVariablesInGlob, validateGlobItem } from "./glob";
export function validateGlobList(
  glob: EngineAssetDefinition["glob"],
){
  if(glob.length === 0){
    throw new Error("Expecting at least 1 glob");
  }
  if(new Set(glob).size !== glob.length){
    throw new Error("Has duplicate globs");
  }
}

export { validatePathVariablesInGlob, validateGlobItem };
