import { JSONSchemaType } from "ajv";
import { RosterLockV1Config } from "@roster-lock/types";
type RosterLockPiece = RosterLockV1Config["rosters"][string][number];
import { defineKeyword } from "../../../../../util-types/json-schema";

import { validateSha256 } from "../validate";
export const sha256SchemaValidator = defineKeyword({
  keyword: "sha256",
  type: "string",
  validate: validateSha256
});

export const versionSchema: JSONSchemaType<RosterLockPiece["version"]> = {
  type: "object",
  additionalProperties: false,
  required: ["logic", "media", "docs"],
  properties: {
    logic: { type: "string", [sha256SchemaValidator.keyword]: true },
    media: { type: "string", [sha256SchemaValidator.keyword]: true },
    docs: { type: "string", [sha256SchemaValidator.keyword]: true },
  },
}
