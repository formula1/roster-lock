import {
  RosterLockV1Config, UserId, PieceType, SelectedPiece, FinalSelection, UserInput
} from "@roster-lock/types";

export * from "./types/untrusted-script";


import { handleGameControlledSelection } from "./selection-types/game-controlled";
import { handlePreselectedSelection } from "./selection-types/preselected";
import { handleNormalSelection } from "./selection-types/normal";
import { ScriptStarter } from "./types/untrusted-script";

import { RunUntrustedError } from "./constants";
import { handleValidationResult } from "./handle-validation";

export async function runSelection(
  config: RosterLockV1Config,
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
        config, seeds, users, pieceType, selectionConfig, allSelections, runScript
      );
      return;
    }
    throw new Error(`Unknown Selection Type ${(selectionConfig as any).type}`);
  }));

  if(!config.selection.globalValidation) return finalSelection;

  await Promise.all(config.selection.globalValidation.map(async (script)=>{
    return handleValidationResult(script, runScript({
      config,
      randomSeeds: seeds,
      purpose: {
        type: "global-validation",
        users,
        pieceTypes: Object.keys(config.engine.pieceDefinitions),
        input: finalSelection,
      },
      entryScript: script,
    }));
  }));

  return finalSelection;
}

