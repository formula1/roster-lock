
import { JSONSchemaType } from "ajv";
import {
  RosterLockV1Config,
  SelectionNormalConfig,
  UserSelectionValidation,
} from "@roster-lock/types";

import { selectionPieceMetaSchema } from "../meta";
import { untrustedScriptRefSchema } from "../script";
import { validateSelectionBanList, validateRange } from "../../validate/selections/normal";
import { defineKeyword } from "../../../../../../util-types/json-schema";

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

export const rangeSchemaValidator = defineKeyword({
  keyword: "selectionRange",
  type: ["number", "array"],
  validate: function (value, config: RosterLockV1Config, path){
    validateRange(value);
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
      [rangeSchemaValidator.keyword]: true,
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
    pieceMeta: { ...selectionPieceMetaSchema, nullable: true },
    validation: { ...userSelectionValidationSchema, nullable: true },
    mergeAlgorithm: { ...untrustedScriptRefSchema, nullable: true },
  },
};


