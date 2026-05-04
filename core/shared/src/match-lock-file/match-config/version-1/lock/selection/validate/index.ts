import { RosterLockV1Config } from "@roster-lock/types";
import { validateSelectionPieceMeta } from "./meta";

import { validateNormal } from "./selections/normal";
import { validatePreselected } from "./selections/preselected";

import { validateGasLimittedScript } from "./script";

export function validateSelectionConfig(
  selectionConfig: RosterLockV1Config["selection"],
  config: RosterLockV1Config
){
  const { engine, rosters } = config;
  for(const [pieceType, selection] of Object.entries(selectionConfig.piece)){
    const pieceDefinition = engine.pieceDefinitions[pieceType];
    if(!pieceDefinition){
      throw new Error(`Piece type ${pieceType} is not defined in engine`);
    }
    validateSelectionPieceMeta(selection.pieceMeta, pieceType, config);
    switch(selection.type){
      case "preselected":
        validatePreselected(selection.pieces, pieceType, config);
        break;
      case "normal":
        validateNormal(selection, pieceType, config);
        break;
      case "game-controlled":
        break;
      case "unselectable":
        break;
    }
  }
  if(selectionConfig.globalValidation){
    for(const script of selectionConfig.globalValidation){
      validateGasLimittedScript(script, config);
    }
  }
}

