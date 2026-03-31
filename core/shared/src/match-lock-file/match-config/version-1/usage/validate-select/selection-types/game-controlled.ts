import { isJSONObject } from "../../../../../../utils/JSON";
import { RosterLockV1Config } from "../../../types";
import { ensurePiecesAreInRoster } from "../ensure-pieces-are-in-roster";
import { FinalSelection, PieceType, SelectedPiece, UserId } from "../types/selection";


export async function handleGameControlledSelection(
  config: RosterLockV1Config,
  users: Array<UserId>,
  pieceType: PieceType,
  gameControlledSelections: Record<PieceType, Array<SelectedPiece> | Record<UserId, Array<SelectedPiece>>>,
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

  const pieceSelections = gameControlledSelections[pieceType];
  if(!pieceSelections){
    throw new Error(`Missing selections for ${pieceType}`);
  }

  if(pieceDefinition.selectionStrategy === "shared"){
    if(!Array.isArray(pieceSelections)){
      throw new Error(`Expected Array for Shared Selection`);
    }
    ensurePiecesAreInRoster(config, pieceType, pieceSelections);
    return { type: "shared", value: pieceSelections };
  }


  if(Array.isArray(pieceSelections) || pieceSelections === null){
    throw new Error(`Expected Record for Personal Selection`);
  }

  for(const userId of users){
    if(!pieceSelections[userId]){
      throw new Error(`Missing selection for ${userId}`);
    }
    ensurePiecesAreInRoster(config, pieceType, pieceSelections[userId]);
  }
  return { type: "personal", value: pieceSelections };
}
