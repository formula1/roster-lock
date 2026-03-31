import { isJSONObject } from "../../../../../../../utils/JSON";
import { SelectionNormalConfig } from "../../../../selection/types";
import { RosterLockV1Config } from "../../../../types";
import { ensurePiecesAreInRoster } from "../../ensure-pieces-are-in-roster";
import { UserId, PieceType, SelectedPiece, FinalSelection } from "../../types/selection";
import { ScriptStarter } from "../../types/untrusted-script";

import { validateUserSelection } from "./validate-user-selection";

export async function handleNormalSelection(
  config: RosterLockV1Config,
  randomSeeds: string[],
  users: Array<UserId>,
  pieceType: PieceType,
  selectionConfig: SelectionNormalConfig,
  allSelections: Record<UserId, Record<PieceType, Array<SelectedPiece>>>,
  scriptsByPath: Record<string, string>,
  runScript: (input: ScriptStarter)=>Promise<any>
): Promise<FinalSelection[PieceType]>{
  const pieceConfig = config.engine.pieceDefinitions[pieceType];
  if(!pieceConfig){
    throw new Error(`Missing piece config for ${pieceType}`);
  }
  if(pieceConfig.selectionStrategy === "mandatory"){
    throw new Error(`Mandatory piece ${pieceType} cannot be normal`);
  }
  if(pieceConfig.selectionStrategy === "on demand"){
    throw new Error(`On demand piece ${pieceType} cannot be normal`);
  }
  await Promise.all(users.map(async (userId)=>{
    const userSelections = allSelections[userId][pieceType];
    if(!userSelections){
      throw new Error(`Missing selections for ${pieceType}`);
    }
    await validateUserSelection(
      config, pieceType, userSelections, selectionConfig, 
    )
    if(!selectionConfig.validation?.customValidation.length){
      return;
    }

    await Promise.all(selectionConfig.validation.customValidation.map(async (script)=>(
      runScript({
        config,
        randomSeeds,
        purpose: {
          type: "piece-user-validation",
          pieceType,
          userId,
          input: userSelections,
        },
        scripts: scriptsByPath,
        entryScriptPath: script.src,
      })
    )))
  }));

  if(pieceConfig.selectionStrategy === "shared" && !selectionConfig.mergeAlgorithm){
    throw new Error(`Shared piece ${pieceType} is missing merge algorithm`);
  }

  const usersSelections: Record<UserId, Array<SelectedPiece>> = {};
  for(const userId of users){
    usersSelections[userId] = allSelections[userId][pieceType];
  }
  // If there is no merge algorithm, we just use the users selections which have been validated
  if(!selectionConfig.mergeAlgorithm){
    return { type: "personal", value: usersSelections };
  }

  const mergedSelection = await runScript({
    config,
    randomSeeds,
    purpose: {
      type: "piece-merge",
      pieceType,
      users,
      input: usersSelections,
    },
    scripts: scriptsByPath,
    entryScriptPath: selectionConfig.mergeAlgorithm.src,
  });

  if(pieceConfig.selectionStrategy === "shared"){
    if(!Array.isArray(mergedSelection)){
      throw new Error(`Expected Array for Shared Selection`);
    }
    ensurePiecesAreInRoster(config, pieceType, mergedSelection);
    return { type: "shared", value: mergedSelection };
  }

  if(typeof mergedSelection !== "object" || Array.isArray(mergedSelection) || mergedSelection === null){
    throw new Error(`Expected Record for Personal Selection`);
  }

  for(const userId of users){
    if(!mergedSelection[userId]){
      throw new Error(`Missing selection for ${userId}`);
    }
    ensurePiecesAreInRoster(config, pieceType, mergedSelection[userId]);
  }
  return { type: "personal", value: mergedSelection };
}
