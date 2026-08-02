
import { JSONSchemaType } from "ajv";
import { RosterLockV1Draft } from "@roster-lock/types";

type RosterLockDraftMediaOverrideInfo = (
  NonNullable<RosterLockV1Draft["draft"]["mediaOverrideInfo"]>["string"]["string"]["string"]
);
export const mediaOverrideInfoSchema: JSONSchemaType<RosterLockDraftMediaOverrideInfo> = {
  type: "object", additionalProperties: false,
  required: ["testedDownloadSources"],
  properties: {
    referenceFolder: { type: "string", nullable: true },
    testedDownloadSources: {
      type: "array",
      items: {
        type: "object",
        required: ["source", "testedAt", "hash"],
        additionalProperties: false,
        properties: {
          source: { type: "string" },
          testedAt: { type: "number" },
          hash: { type: "string" },
        },
      },
    },
  },
};
