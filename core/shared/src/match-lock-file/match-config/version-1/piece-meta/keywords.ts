
import {
  urlSchemaValidator,
  friendlyStringSchemaValidator,
} from "../lock/rosters/caster-json-schema/human";
import {
  downloadableSourceSchemaValidator,
  downloadableSourceListSchemaValidator,
} from "../lock/rosters/caster-json-schema/downloadableSources";
import {
  pathVariableNameSchemaValidator,
  pathVariableValueSchemaValidator,
  allPathVariableNameSetSchemaValidator,
} from "../lock/rosters/caster-json-schema/pathVariables";

import { defineKeyword } from "../../../util-types/json-schema";

function ignore(){ return true; }

export const rosterLockPieceMetadataKeywords = [
  urlSchemaValidator,
  friendlyStringSchemaValidator,

  downloadableSourceSchemaValidator,
  downloadableSourceListSchemaValidator,
  defineKeyword({
    keyword: pathVariableNameSchemaValidator.keyword,
    type: pathVariableNameSchemaValidator.type,
    validate: ignore,
  }),
  defineKeyword({
    keyword: pathVariableValueSchemaValidator.keyword,
    type: pathVariableValueSchemaValidator.type,
    validate: ignore,
  }),
  defineKeyword({
    keyword: allPathVariableNameSetSchemaValidator.keyword,
    type: allPathVariableNameSetSchemaValidator.type,
    validate: ignore,
  }),
]
