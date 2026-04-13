import micromatch from "micromatch";
import { RosterLockV1Config } from "@roster-lock/types";
type RosterLockEngineConfig = RosterLockV1Config["engine"];

import { validatePathVariableValue } from "../../lock/rosters/validate";
/**
 * Test a single file against piece definition assets
 */
export function getMatchingAssetsForFile(
  pieceDefinition: RosterLockEngineConfig['pieceDefinitions'][string],
  pathVariables: Record<string, string>,
  relativePath: string,
): Array<RosterLockEngineConfig['pieceDefinitions'][string]['assets'][number]> {

  for(const variableValue of Object.values(pathVariables)){
    validatePathVariableValue(variableValue);
  }

  return pieceDefinition.assets.filter((asset) =>(
    asset.glob.some((glob)=>{
      // Replace path variables
      glob = replacePathVariables(glob, pathVariables);
      // check if the relativePath is exactly the glob
      // TODO: eventually we want to see if the glob is a file path and if so, check for exact match
      // Relative path isn't expected to have any glob parts, so an exact match is expected to be ok
      // If a filepath can have glob parts, we may be in trouble
      if(relativePath === glob) return true;
      // check if the relativePath matches the glob
      if(micromatch.isMatch(relativePath, glob)) return true;
      return false;
    })
  ));
}

function replacePathVariables(
  glob: string, pathVariables: Record<string, string>
){
  for(const [variableName, value] of Object.entries(pathVariables)){
    glob = glob.replaceAll(`<${variableName}>`, value);
  }
  return glob;
}
