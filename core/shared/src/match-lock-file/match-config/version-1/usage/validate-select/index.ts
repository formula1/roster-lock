import {
  RosterLockV1Config, PlayerId, PieceType, SelectedPiece, FinalSelection, UserInput
} from "@roster-lock/types";


import { handleGameControlledSelection } from "./selection-types/game-controlled";
import { handlePreselectedSelection } from "./selection-types/preselected";
import { handleNormalSelection } from "./selection-types/normal";
import { ScriptStarter } from "@roster-lock/types";

import { RunUntrustedError } from "./constants";
import { handleValidationResult } from "./handle-validation";

export async function runSelection(
  config: RosterLockV1Config,
  gameControlledSelections: Record<PieceType, Array<SelectedPiece> | Record<PlayerId, Array<SelectedPiece>>>,
  userInputs: Record<PlayerId, UserInput>,
  runScript: (input: ScriptStarter)=>Promise<any>
){
  const users: Array<string> = [];
  const seeds: Array<string> = [];
  const allSelections: Record<PlayerId, Record<PieceType, Array<SelectedPiece>>> = {};
  // userInputs is built by each party independently (e.g. from concurrent
  // per-player decryption), so its key-insertion order isn't guaranteed to
  // match across parties. Sort by playerId so the merge script's RNG seed
  // (derived from `seeds`) is deterministic regardless of insertion order -
  // otherwise two parties can compute different "random" tie-breaks for the
  // same selection and disagree on the final result.
  const sortedPlayerIds = Object.keys(userInputs).sort();
  for(const playerId of sortedPlayerIds){
    const { randomSeed, userSelection } = userInputs[playerId];
    users.push(playerId);
    seeds.push(randomSeed);
    allSelections[playerId] = userSelection;
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

  const strippedSelection: Record<PieceType, Array<SelectedPiece> | Record<PlayerId, Array<SelectedPiece>>> = {};
  for(const [k,v] of Object.entries(finalSelection)){
    strippedSelection[k] = v.value;
  }

  await Promise.all(config.selection.globalValidation.map(async (script)=>{
    return handleValidationResult(script, runScript({
      config,
      randomSeeds: seeds,
      purpose: {
        type: "global-validation",
        users,
        pieceTypes: Object.keys(config.engine.pieceDefinitions),
        input: strippedSelection,
      },
      entryScript: script,
    }));
  }));

  return finalSelection;
}

