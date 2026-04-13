import { RosterLockV1Config } from "@roster-lock/types";

export * from "./id";
export * from "./downloadable-source";
export * from "./human";
export * from "./path-variables";
export * from "./required-pieces";
export * from "./utils";
export * from "./version";

import { validateVersions } from "./version";
import { validateHumanInfo } from "./human";
import {
  validateDownloadableSourceList,
  validateDownloadableSource
} from "./downloadable-source";
import {
  validateAllExpectedPathVariableNamesSet,
  validatePathVariableNameIsExpected,
  validatePathVariableValue,
} from "./path-variables";
import {
  validateAllExpectedRequiredPieceTypesSet,
  validateRequiredPieceType,
  validateRequiredPieceValue,
} from "./required-pieces";
import { validatePieceId, validatePieceIdUniqueness } from "./id";
export function validateRosterLockPieces(
  config: RosterLockV1Config
){
  const { engine, rosters } = config;
  validateAllEnginePiecesDefined(rosters, engine);
  for(const [pieceType, pieceList] of Object.entries(rosters)){
    for(let i = 0; i < pieceList.length; i++){
      const piece = pieceList[i];
      validatePieceInEngine(pieceType, engine);
      const pieceConfig = engine.pieceDefinitions[pieceType];

      validatePieceId(piece.id);
      validatePieceIdUniqueness(piece.id, i, pieceList);

      validateVersions(piece.version);
      validateHumanInfo(piece.humanInfo);
      // Download Sources
      validateDownloadableSourceList(piece.downloadSources);
      for(const downloadSource of piece.downloadSources){
        validateDownloadableSource(downloadSource);
      }

      // Path Variables
      validateAllExpectedPathVariableNamesSet(piece.pathVariables, pieceConfig);
      for(const [variableName, variableValue] of Object.entries(piece.pathVariables)){
        validatePathVariableNameIsExpected(variableName, pieceConfig);
        validatePathVariableValue(variableValue);
      }

      // Required Pieces
      validateAllExpectedRequiredPieceTypesSet(piece.requiredPieces, pieceConfig);
      for(const [requiredPieceType, requiredPiece] of Object.entries(piece.requiredPieces)){
        validateRequiredPieceType(requiredPieceType, config);
        for(const pieceSha of requiredPiece.expected){
          validateRequiredPieceValue(requiredPieceType, pieceSha, rosters[requiredPieceType]);
        }
      }
    }
  }
}

export function validateAllEnginePiecesDefined(
  rosters: RosterLockV1Config["rosters"], engine: RosterLockV1Config["engine"]
){
  for(const pieceType of Object.keys(engine.pieceDefinitions)){
    if(!(pieceType in rosters)){
      throw new Error(`Piece type ${pieceType} is defined in engine but not in roster`);
    }
  }
}

export function validatePieceInEngine(
  pieceType: string, engine: RosterLockV1Config["engine"]
){
  if(!(pieceType in engine.pieceDefinitions)){
    throw new Error(`Piece type ${pieceType} is not defined in engine`);
  }
}
