import { SelectionPreselectedConfig } from "../../../selection/types";
import { RosterLockV1Config } from "../../../types";
import { ensurePiecesAreInRoster } from "../ensure-pieces-are-in-roster";
import { FinalSelection, PieceType, SelectedPiece, UserId } from "../types/selection";


export async function handlePreselectedSelection(
  config: RosterLockV1Config,
  users: Array<UserId>,
  pieceType: PieceType,
  selectionConfig: SelectionPreselectedConfig,
): Promise<FinalSelection[PieceType]>{
  const pieceDefinition = config.engine.pieceDefinitions[pieceType];
  if(!pieceDefinition){
    throw new Error(`Missing piece config for ${pieceType}`);
  }
  if(pieceDefinition.selectionStrategy === "mandatory"){
    throw new Error(`Mandatory piece ${pieceType} cannot be game controlled`);
  }
  if(pieceDefinition.selectionStrategy === "on demand"){
    throw new Error(`On demand piece ${pieceType} cannot be game controlled`);
  }

  ensurePiecesAreInRoster(config, pieceType, selectionConfig.pieces);

  if(pieceDefinition.selectionStrategy === "shared"){
    return { type: "shared", value: selectionConfig.pieces };
  }

  const userSelections: Record<UserId, Array<SelectedPiece>> = {};
  for(const userId of users){
    userSelections[userId] = selectionConfig.pieces;
  }
  return { type: "personal", value: userSelections };
}
