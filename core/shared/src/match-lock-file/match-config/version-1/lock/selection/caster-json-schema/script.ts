
import { JSONSchemaType } from "ajv";
import { RosterLockV1Config, UntrustedScriptRef } from "@roster-lock/types";
import { defineKeyword } from "../../../../../util-types/json-schema";

import {
  validateUntrustedScriptSrc,
  validateUntrustedScriptMethod,
  validateUntrustedScriptExtension,
} from "../validate/script";

export const scriptRefSrcSchemaValidator = defineKeyword({
  keyword: "untrustedScriptSrc",
  type: "string",
  validate(value, config: RosterLockV1Config){
    validateUntrustedScriptSrc(value, config);
  }
});

export const scriptRefMethodSchemaValidator = defineKeyword({
  keyword: "untrustedScriptMethod",
  type: "string",
  validate(value, config: RosterLockV1Config){
    validateUntrustedScriptMethod(value);
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



export const scriptDictionaryExtensionSchemaValidator = defineKeyword({
  keyword: "untrustedScriptExtension",
  type: "string",
  validate(value){
    validateUntrustedScriptExtension(value);
  }
});

export const untrustedScriptDictionarySchema: JSONSchemaType<RosterLockV1Config["selection"]["scriptDictionary"]> = {
  type: "object", required: [],
  propertyNames: {
    type: "string",
    [scriptDictionaryExtensionSchemaValidator.keyword]: true,
  },
  additionalProperties: {
    type: "object", required: ["content"],
    additionalProperties: false,
    properties: {
      content: { type: "string" },
    }
  }
};
