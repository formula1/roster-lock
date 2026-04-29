
import { JSONSchemaType } from "ajv";
import { RosterLockV1Draft } from "@roster-lock/types";

type RosterLockDraftScriptInfo = RosterLockV1Draft["draft"]["selectionScriptInfo"][string];


export const selectionScriptInfoSchema: JSONSchemaType<RosterLockDraftScriptInfo> = {
  type: "object", required: ["lastLoad", "sha", "referencePath"],
  additionalProperties: false,
  properties: {
    lastLoad: { type: "string" },
    sha: { type: "string" },
    referencePath: { type: "string" },
  }
}
