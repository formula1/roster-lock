
import { RosterLockV1Config, SelectionPreselectedConfig, PieceType } from "@roster-lock/types";

import { ensurePiecesAreInRoster } from "../../../../usage/validate-select/ensure-pieces-are-in-roster";

const PRESELECTABLE_STRATEGIES = ["shared", "personal"];
export function validatePreselected(
  selections: SelectionPreselectedConfig["pieces"],
  pieceType: PieceType,
  config: RosterLockV1Config
){
  const { engine } = config;
  const defintion = engine.pieceDefinitions[pieceType];
  if(!PRESELECTABLE_STRATEGIES.includes(defintion.selectionStrategy)){
    throw new Error(`Piece type ${pieceType} is not preselectable`);
  }
  ensurePiecesAreInRoster(config, pieceType, selections);
}
