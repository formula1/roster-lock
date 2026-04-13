
import { JSONSchemaType } from "ajv";
import { RosterLockV1Draft } from "@roster-lock/types";
import { JSONSchemaCaster, defineKeyword } from "../../../util-types/json-schema";

import { rosterLockPiece } from "../lock/rosters";

import { RosterLockV1Schema, RosterLockV1SchemaKeywords } from "../lock";

type RosterLockDraftPiece = RosterLockV1Draft["stagedLock"]["rosters"][string][number]
type RosterLockDraftPieceInfo = RosterLockDraftPiece["draftInfo"];
const draftInfoSchema: JSONSchemaType<RosterLockDraftPieceInfo> = {
  type: "object", additionalProperties: false,
  required: ["testedDownloadSources"],
  properties: {
    referenceFolder: { type: "string", nullable: true },
    testedDownloadSources: {
      type: "array",
      items: {
        type: "object",
        required: ["source", "testedAt", "version"],
        additionalProperties: false,
        properties: {
          source: { type: "string" },
          testedAt: { type: "string" },
          version: {
            type: "object", additionalProperties: false,
            required: ["logic", "media", "docs"],
            properties: {
              logic: { type: "string" },
              media: { type: "string" },
              docs: { type: "string" },
            }
          }
        },
      },
    },
  },
};

const draftPieceSchema: JSONSchemaType<RosterLockDraftPiece> = {
  type: "object",
  required: rosterLockPiece.required.concat(["draftInfo"]),
  additionalProperties: false,
  properties: {
    ...rosterLockPiece.properties,
    draftInfo: draftInfoSchema,
  },
} as JSONSchemaType<RosterLockDraftPiece>;

export const RosterLockV1DraftSchema: JSONSchemaType<RosterLockV1Draft> = {
  type: "object",
  required: ["configPurpose", "configVersion", "previousVersion", "pendingLock"],
  additionalProperties: false,
  properties: {
    configPurpose: { type: "string", const: "draft" },
    configVersion: { type: "number", const: 1 },
    previousVersion: { type: "string" },
    previousLock: {
      ...RosterLockV1Schema, nullable: true
    },
    stagedLock: {
      type: "object",
      required: RosterLockV1Schema.properties.required,
      additionalProperties: false,
      properties: {
        ...RosterLockV1Schema.properties,
        rosters: {
          type: "object", required: [],
          additionalProperties: { type: "array", items: draftPieceSchema },
        },
      },
    },
  },
} as JSONSchemaType<RosterLockV1Draft>;

function ignore(){ return true; }
export const RosterLockV1DraftSchemaKeywords = RosterLockV1SchemaKeywords.map((keywordDef)=>{
  return defineKeyword({ keyword: keywordDef.keyword, type: keywordDef.type, validate: ignore  })
});

export const ROSTERLOCK_V1_DRAFT_CASTER_JSONSCHEMA = new JSONSchemaCaster<RosterLockV1Draft>(
  RosterLockV1DraftSchema,
  RosterLockV1DraftSchemaKeywords,
);
