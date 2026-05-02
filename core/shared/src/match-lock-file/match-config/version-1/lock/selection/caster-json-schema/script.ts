
import { JSONSchemaType } from "ajv";
import { RosterLockV1Config, UntrustedScriptRef } from "@roster-lock/types";
import { defineKeyword } from "../../../../../util-types/json-schema";

import {
  validateGasLimittedScriptSrc,
  validateGasLimittedScriptMethod,
  validateGasLimittedScriptMimetype,
} from "../validate/script";

export const scriptRefSrcSchemaValidator = defineKeyword({
  keyword: "untrustedScriptSrc",
  type: "string",
  validate(value, config: RosterLockV1Config){
    validateGasLimittedScriptSrc(value, config);
  }
});

export const scriptRefMethodSchemaValidator = defineKeyword({
  keyword: "untrustedScriptMethod",
  type: "string",
  validate(value, config: RosterLockV1Config){
    validateGasLimittedScriptMethod(value);
  }
});

export const untrustedScriptRefSchema: JSONSchemaType<UntrustedScriptRef> = {
  type: "object",
  required: ["src"],
  additionalProperties: false,
  properties: {
    src: {
      type: "string",
      [scriptRefSrcSchemaValidator.keyword]: true
    },
    method: {
      type: "string", nullable: true,
      [scriptRefMethodSchemaValidator.keyword]: true
    }
  },
};



export const scriptDictionaryMimetypeSchemaValidator = defineKeyword({
  keyword: "untrustedScriptMimetype",
  type: "string",
  validate(value){
    validateGasLimittedScriptMimetype(value);
  }
});

export const untrustedScriptDictionarySchema: JSONSchemaType<RosterLockV1Config["selection"]["scriptDictionary"]> = {
  type: "object",
  required: [],
  additionalProperties: {
    type: "object", required: ["mimeType", "content"],
    additionalProperties: false,
    properties: {
      mimeType: { type: "string", [scriptDictionaryMimetypeSchemaValidator.keyword]: true },
      content: { type: "string" },
    }
  }
};
