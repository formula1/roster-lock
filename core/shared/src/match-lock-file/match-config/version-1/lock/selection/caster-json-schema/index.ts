import { JSONSchemaType } from "ajv";


import { RosterLockV1Config } from "@roster-lock/types";

import { preselectedSelectionSchema } from "./selection-types/preselected";
import { normalSelectionSchema } from "./selection-types/normal";
import { gameControlledSelectionSchema } from "./selection-types/game-controlled";
import { unselectableSelectionSchema } from "./selection-types/unselectable";

import {
  untrustedScriptRefSchema, scriptRefSrcSchemaValidator, scriptRefMethodSchemaValidator,
  untrustedScriptDictionarySchema, scriptDictionaryExtensionSchemaValidator
} from "./script";
export { untrustedScriptRefSchema };

export const selectionConfigSchema: JSONSchemaType<RosterLockV1Config["selection"]> = {
  type: "object",
  required: ["piece", "scriptDictionary"],
  additionalProperties: false,
  properties: {
    piece: {
      type: "object",
      required: [],
      additionalProperties: {
        oneOf: [
          preselectedSelectionSchema,
          normalSelectionSchema,
          gameControlledSelectionSchema,
          unselectableSelectionSchema
        ],
      },
    },
    globalValidation: {
      type: "array",
      items: untrustedScriptRefSchema,
    },
    scriptDictionary: untrustedScriptDictionarySchema
  },
};


import { banListSchemaValidator } from "./selection-types/normal";
import { preselectedSchemaValidator } from "./selection-types/preselected";

import {
  metaDefaultValueSchemaValidator,
  metaPieceValueSchemaValidator
} from "./meta";

export const selectionKeywords = [
  banListSchemaValidator,

  preselectedSchemaValidator,

  metaDefaultValueSchemaValidator,
  metaPieceValueSchemaValidator,

  scriptRefSrcSchemaValidator,
  scriptRefMethodSchemaValidator,
  scriptDictionaryExtensionSchemaValidator,
];
