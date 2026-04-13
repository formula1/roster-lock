import { defineKeyword } from "../../../../../../util-types/json-schema";

import { validatePathVariables, validatePathVariableName } from "../../validate/piece/path-variables";
export const pathVariableListSchemaValidator = defineKeyword({
  keyword: "pathVariableList",
  type: "array",
  validate: validatePathVariables
})

export const pathVariableNameSchemaValidator = defineKeyword({
  keyword: "pathVariableName",
  type: "string",
  validate: validatePathVariableName
})
