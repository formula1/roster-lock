
import { JSONSchemaType } from "ajv";
import {
  RosterLockV1Config,
  SelectionNormalConfig,
  UserSelectionValidation,
} from "@roster-lock/types";

import { selectionPieceMetaSchema } from "../meta";
import { untrustedScriptRefSchema } from "../script";
import { validateSelectionBanList } from "../../validate/selections/normal";
import { defineKeyword } from "../../../../../../util-types/json-schema";
import { countSchema, countSchemaValidator } from "../../../../shared/count";
export { countSchemaValidator };

export const banListSchemaValidator = defineKeyword({
  keyword: "selectionBanList",
  type: "array",
  validate: function (banList: Array<string>, { rosters }: RosterLockV1Config, path){
    if(!banList) return;
    // /selection/piece/pieceType/validation/banList
    const pieceType = path.split("/").at(-3);
    if(!pieceType) throw new Error("Invalid path");
    const roster = rosters[pieceType];
    validateSelectionBanList(banList, roster);
  }
});


const userSelectionValidationSchema: JSONSchemaType<UserSelectionValidation> = {
  type: "object",
  required: ["count", "unique", "customValidation"],
  additionalProperties: false,
  properties: {
    count: countSchema,
    unique: { type: "boolean" },
    banList: {
      type: "array",
      items: { type: "string" },
      [banListSchemaValidator.keyword]: true,
    },
    customValidation: {
      type: "array",
      items: untrustedScriptRefSchema,
    },
  },
};

export const normalSelectionSchema: JSONSchemaType<SelectionNormalConfig> = {
  type: "object",
  required: ["type"],
  additionalProperties: false,
  properties: {
    type: { type: "string", const: "normal" },
    pieceMeta: selectionPieceMetaSchema,
    validation: userSelectionValidationSchema,
    mergeAlgorithm: { ...untrustedScriptRefSchema, nullable: true },
  },
};


