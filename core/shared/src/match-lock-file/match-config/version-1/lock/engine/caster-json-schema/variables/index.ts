
import { JSONSchemaType } from "ajv";
import { pathVariableListSchemaValidator, pathVariableNameSchemaValidator } from "./keywords";
import { RosterLockV1Config } from "@roster-lock/types";
type RosterLockEngineConfig = RosterLockV1Config["engine"];

export const pathVariableKeywords = [
  pathVariableListSchemaValidator,
  pathVariableNameSchemaValidator,
]


export const pathVariablesSchema: JSONSchemaType<
  RosterLockEngineConfig["pieceDefinitions"][string]["pathVariables"]
> = {
  [pathVariableListSchemaValidator.keyword]: true,
  type: "array",
  items: {
    [pathVariableNameSchemaValidator.keyword]: true,
    type: "string",
  },
}
