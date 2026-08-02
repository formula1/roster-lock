
import { JSONSchemaType } from "ajv";
import { RosterLockV1Draft } from "@roster-lock/types";
import { JSONSchemaCaster, defineKeyword } from "../../../util-types/json-schema";

import { RosterLockV1Schema, RosterLockV1SchemaKeywords } from "../lock";

import { buildIdentity } from "../shared";

import { rosterPieceInfoSchema } from "./roster-piece-info";
import { mediaOverrideInfoSchema } from "./media-override-info";
import { selectionScriptInfoSchema } from "./selection-script-info";

export const RosterLockV1DraftSchema: JSONSchemaType<RosterLockV1Draft> = {
  type: "object",
  required: ["configIdentity", "previousLock", "stagedLock", "draft"],
  additionalProperties: false,
  $defs: {
    RosterLockV1Config: RosterLockV1Schema,
  },
  properties: {
    configIdentity: buildIdentity("draft", 1),
    previousLock: { $ref: "#/$defs/RosterLockV1Config" },
    stagedLock: { $ref: "#/$defs/RosterLockV1Config" },
    draft: {
      type: "object", required: ["rosterPieceInfo", "selectionScriptInfo"],
      additionalProperties: false,
      properties: {
        rosterPieceInfo: {
          type: "object", required: [],
          additionalProperties: {
            type: "object", required: [],
            additionalProperties: rosterPieceInfoSchema
          }
        },
        mediaOverrideInfo: {
          type: "object", nullable: true, required: [],
          additionalProperties: {
            type: "object", required: [],
            additionalProperties: {
              type: "object", required: [],
              additionalProperties: mediaOverrideInfoSchema
            }
          }
        },
        selectionScriptInfo: {
          type: "object", required: [],
          additionalProperties: selectionScriptInfoSchema
        }
      }
    }
  },
} as JSONSchemaType<RosterLockV1Draft>;

function ignore(){ return true; }
export const RosterLockV1DraftSchemaKeywords = RosterLockV1SchemaKeywords.map((keywordDef)=>{
  return defineKeyword({ keyword: keywordDef.keyword, type: keywordDef.type, validate: ignore });
});

export const ROSTERLOCK_V1_DRAFT_CASTER_JSONSCHEMA = new JSONSchemaCaster<RosterLockV1Draft>(
  RosterLockV1DraftSchema,
  RosterLockV1DraftSchemaKeywords,
);
