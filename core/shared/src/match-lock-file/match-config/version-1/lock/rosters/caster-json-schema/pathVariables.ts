import { JSONSchemaType } from "ajv";
import { RosterLockV1Config } from "@roster-lock/types";
type RosterLockPiece = RosterLockV1Config["rosters"][string][number];
import { defineKeyword } from "../../../../../util-types/json-schema";
import {
  validatePathVariableNameIsExpected,
  validatePathVariableValue, 
  validateAllExpectedPathVariableNamesSet,
} from "../validate";

export const pathVariableNameSchemaValidator = defineKeyword({
  keyword: "rosterPathVariableName",
  type: "object",
  validate: function (pathVariableValue, { engine }: RosterLockV1Config, path){
    const pathParts = path.split("/");
    // config/pieces/pieceType/pieceIndex/pathVariables/variableName/index
    const variableName = pathParts.at(-2);
    if(!variableName)
      throw new Error(`Invalid variable name path`);
    const pieceType = pathParts.at(-5);
    if(!pieceType)
      throw new Error(`Invalid piece type path`);

    const pieceDefinition = engine.pieceDefinitions[pieceType];
    validatePathVariableNameIsExpected(variableName, pieceDefinition);
  }
});

export const pathVariableValueSchemaValidator = defineKeyword({
  keyword: "rosterPathVariableValue",
  type: "object",
  validate: function (pathVariableValue, { engine }: RosterLockV1Config, path){
    validatePathVariableValue(pathVariableValue);
  }
});

export const allPathVariableNameSetSchemaValidator = defineKeyword({
  keyword: "rosterAllPathVariableNameSet",
  type: "object",
  validate: function (pathVariables, { engine }: RosterLockV1Config, path){
    // config/pieces/pieceType/pieceIndex/pathVariables
    const pieceType = path.split("/").at(-3);
    if(!pieceType)
      throw new Error(`Invalid piece type path`);
    const pieceDefinition = engine.pieceDefinitions[pieceType];
    validateAllExpectedPathVariableNamesSet(pathVariables, pieceDefinition);
  }
});

export const pathVariablesSchema: JSONSchemaType<RosterLockPiece["pathVariables"]> = {
  type: "object",
  [allPathVariableNameSetSchemaValidator.keyword]: true,
  required: [],
  additionalProperties: {
    type: "string",
    [pathVariableNameSchemaValidator.keyword]: true,
    [pathVariableValueSchemaValidator.keyword]: true,
  },
}
