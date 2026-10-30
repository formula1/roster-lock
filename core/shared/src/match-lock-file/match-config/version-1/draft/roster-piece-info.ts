
import { JSONSchemaType } from "ajv";
import { RosterLockV1Draft } from "@roster-lock/types";
import { nullable } from "../../../util-types/json-schema";

type RosterLockDraftPieceInfo = RosterLockV1Draft["draft"]["rosterPieceInfo"]["string"]["string"];
export const rosterPieceInfoSchema: JSONSchemaType<RosterLockDraftPieceInfo> = {
  type: "object", additionalProperties: false,
  required: ["testedDownloadSources"],
  properties: {
    referenceFolder: nullable({ type: "string" }),
    testedDownloadSources: {
      type: "array",
      items: {
        type: "object",
        required: ["source", "testedAt", "version"],
        additionalProperties: false,
        properties: {
          source: { type: "string" },
          testedAt: { type: "number" },
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