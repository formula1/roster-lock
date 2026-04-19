import { defineKeyword } from "../../../../../../util-types/json-schema";

import { validatePathVariables, validatePathVariableName } from "../../validate/piece/path-variables";
export const pathVariableListSchemaValidator = defineKeyword({
  keyword: "enginePathVariableList",
  type: "array",
  validate: validatePathVariables
})

export const pathVariableNameSchemaValidator = defineKeyword({
  keyword: "enginePathVariableName",
  type: "string",
  validate: validatePathVariableName
})
