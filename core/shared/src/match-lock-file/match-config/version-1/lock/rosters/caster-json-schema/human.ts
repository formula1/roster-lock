import { JSONSchemaType } from "ajv"
import { RosterLockV1Config } from "@roster-lock/types";
type RosterLockPiece = RosterLockV1Config["rosters"][string][number];
import { defineKeyword } from "../../../../../util-types/json-schema";


import { validateURL, validateImageDataURI } from "../validate";
export const urlSchemaValidator = defineKeyword({
  keyword: "URL",
  type: "string",
  validate: validateURL
});

export const imageDataURISchemaValidator = defineKeyword({
  keyword: "imageDataURI",
  type: "string",
  validate: validateImageDataURI
});

import { validateFriendlyString } from "../validate/human";
export const friendlyStringSchemaValidator = defineKeyword({
  keyword: "friendlyString",
  type: "string",
  validate: validateFriendlyString
});


export const humanInfoSchema: JSONSchemaType<RosterLockPiece["humanInfo"]> = {
  type: "object",
  additionalProperties: false,
  required: ["name", "author", "url"],
  properties: {
    name: { type: "string", [friendlyStringSchemaValidator.keyword]: true },
    author: { type: "string", [friendlyStringSchemaValidator.keyword]: true },
    url: { type: "string", [urlSchemaValidator.keyword]: true },
    image: { type: "string", [imageDataURISchemaValidator.keyword]: true, nullable: true },
  },
}

