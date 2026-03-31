
import { JSONSchemaType } from "ajv";
import {
  SelectionNormalConfig,
  UserSelectionValidation,
} from "../../types/selection-types/normal";

import { selectionPieceMetaSchema } from "../meta";
import { gasLimittedScriptSchema } from "../script";
import { validateSelectionBanList } from "../../validate/selections/normal";
import { defineKeyword } from "../../../../../util-types/json-schema";
import { RosterLockV1Config } from "../../../types";

export const banListSchemaValidator = defineKeyword({
  keyword: "banList",
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
    count: {
      anyOf: [
        { type: "number", minimum: 0 },
        { type: "string", const: "*" },
        {
          type: "array",
          items: [
            { type: "number", minimum: 0 },
            { anyOf: [{ type: "number", minimum: 0 }, { type: "string", const: "*" }] },
          ],
          minItems: 2,
          maxItems: 2,
        },
      ],
    },
    unique: { type: "boolean" },
    banList: {
      type: "array",
      items: { type: "string" },
      nullable: true,
      [banListSchemaValidator.keyword]: true,
    },
    customValidation: {
      type: "array",
      items: gasLimittedScriptSchema,
    },
  },
}

export const normalSelectionSchema: JSONSchemaType<SelectionNormalConfig> = {
  type: "object",
  required: ["type"],
  additionalProperties: false,
  properties: {
    type: { type: "string", const: "normal" },
    pieceMeta: { ...selectionPieceMetaSchema, nullable: true },
    validation: { ...userSelectionValidationSchema, nullable: true },
    mergeAlgorithm: { ...gasLimittedScriptSchema, nullable: true },
  },
}


