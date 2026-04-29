
import { humanInfoSchema } from "../lock/rosters/caster-json-schema/human";
import {
  downloadableSourcesSchema,
} from "../lock/rosters/caster-json-schema/downloadableSources";
import {
  pathVariablesSchema,
} from "../lock/rosters/caster-json-schema/pathVariables";

import { JSONSchemaType } from "ajv";

import { RosterLockV1PieceMetadata } from "@roster-lock/types";

import { buildIdentity } from "../shared";


export const rosterLockPieceMetadataSchema: JSONSchemaType<RosterLockV1PieceMetadata> = {
  type: "object",
  required: ["configIdentity", "humanInfo", "downloadSources", "pathVariables"],
  additionalProperties: false,
  properties: {
    configIdentity: buildIdentity("piece-meta", 1),

    humanInfo: humanInfoSchema,
    downloadSources: downloadableSourcesSchema,
    pathVariables: pathVariablesSchema,
  },
}

