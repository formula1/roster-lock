
import { humanInfoSchema } from "../lock/rosters/caster-json-schema/human";
import {
  downloadableSourcesSchema,
} from "../lock/rosters/caster-json-schema/downloadableSources";
import {
  pathVariablesSchema,
} from "../lock/rosters/caster-json-schema/pathVariables";

import { JSONSchemaType } from "ajv";

import { RosterLockV1PieceInfo } from "@roster-lock/types";

import { buildIdentity } from "../shared";


export const rosterLockPieceInfoSchema: JSONSchemaType<RosterLockV1PieceInfo> = {
  type: "object",
  required: ["configIdentity", "humanInfo", "downloadSources", "pathVariables"],
  additionalProperties: false,
  properties: {
    configIdentity: buildIdentity("piece-info", 1),

    humanInfo: humanInfoSchema,
    downloadSources: downloadableSourcesSchema,
    pathVariables: pathVariablesSchema,
  },
}

