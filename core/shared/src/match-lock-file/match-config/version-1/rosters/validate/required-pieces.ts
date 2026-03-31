import { RosterLockV1Config } from "@roster-lock/types";

export function validateAllExpectedRequiredPieceTypesSet(
  requiredPieces: RosterLockV1Config["rosters"][string][0]["requiredPieces"],
  pieceConfig: RosterLockV1Config["engine"]["pieceDefinitions"][string],
){
  for(const requiredPieceType of pieceConfig.requires){
    if(!(requiredPieceType in requiredPieces)){
      throw new Error(`Piece is missing required piece type ${requiredPieceType}`);
    }
  }
}

export function validateRequiredPieceType(
  pieceType: string, { engine, rosters }: RosterLockV1Config
){
  const pieceDefinition = engine.pieceDefinitions[pieceType];
  if(!pieceDefinition)
    throw new Error(`Piece type ${pieceType} is not defined in engine`);
  if(!(pieceType in rosters))
    throw new Error(`Piece type ${pieceType} is not defined in roster`);
}

export function validateRequiredPieceValue(
  pieceType: string, pieceId: string, roster: RosterLockV1Config["rosters"][string]
){
  if(!roster.find((p) => p.id === pieceId)){
    throw new Error(`Piece type ${pieceType} does not have the required piece with id ${pieceId}`);
  }
}
