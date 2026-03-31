import { RosterLockV1Config } from "../../types";

export * from "./types/selection";
export * from "./types/untrusted-script";

import { UserId, PieceType, SelectedPiece } from "./types/selection";

import { handleGameControlledSelection } from "./selection-types/game-controlled";
import { handlePreselectedSelection } from "./selection-types/preselected";
import { handleNormalSelection } from "./selection-types/normal";
import { ScriptStarter } from "./types/untrusted-script";
import { UserInput, FinalSelection } from "./types/selection";

export async function runSelection(
  config: RosterLockV1Config,
  scriptsByPath: Record<string, string>,
  gameControlledSelections: Record<PieceType, Array<SelectedPiece> | Record<UserId, Array<SelectedPiece>>>,
  userInputs: Record<UserId, UserInput>,
  runScript: (input: ScriptStarter)=>Promise<any>
){
  const users: Array<string> = [];
  const seeds: Array<string> = [];
  const allSelections: Record<UserId, Record<PieceType, Array<SelectedPiece>>> = {};
  for(const [userId, { randomSeed, userSelection }] of Object.entries(userInputs)){
    users.push(userId);
    seeds.push(randomSeed);
    allSelections[userId] = userSelection;
  }

  const finalSelection: FinalSelection = {};
  await Promise.all(Object.entries(config.engine.pieceDefinitions).map(async ([
    pieceType, pieceConfig
  ])=>{
    // Skip on demand pieces
    if(pieceConfig.selectionStrategy === "on demand") return;
    if(pieceConfig.selectionStrategy === "mandatory"){
      if(!config.rosters[pieceType]){
        throw new Error(`Missing roster for mandatory piece ${pieceType}`);
      }
      return;
    }

    const selectionConfig = config.selection.piece[pieceType];
    if(!selectionConfig){
      throw new Error(`Missing selection config for ${pieceType}`);
    }
    if(selectionConfig.type === "game-controlled"){
      finalSelection[pieceType] = await handleGameControlledSelection(
        config, users, pieceType, gameControlledSelections
      );
      return;
    }
    if(selectionConfig.type === "preselected"){
      finalSelection[pieceType] = await handlePreselectedSelection(
        config, users, pieceType, selectionConfig
      );
      return;
    }
    if(selectionConfig.type === "normal"){
      finalSelection[pieceType] = await handleNormalSelection(
        config, seeds, users, pieceType, selectionConfig, allSelections, scriptsByPath, runScript
      );
      return;
    }
    throw new Error(`Unknown Selection Type ${(selectionConfig as any).type}`);
  }))

  if(!config.selection.globalValidation) return finalSelection;

  await Promise.all(config.selection.globalValidation.map(async (script)=>{
    await runScript({
      config,
      randomSeeds: seeds,
      purpose: {
        type: "global-validation",
        users,
        pieceTypes: Object.keys(config.engine.pieceDefinitions),
        input: finalSelection,
      },
      scripts: scriptsByPath,
      entryScriptPath: script.src,
    })
  }));

  return finalSelection;
}

