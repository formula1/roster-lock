
import { humanInfoSchema } from "../lock/rosters/caster-json-schema/human";
import {
  downloadableSourcesSchema,
} from "../lock/rosters/caster-json-schema/downloadableSources";
import {
  pathVariablesSchema,
} from "../lock/rosters/caster-json-schema/pathVariables";

import { JSONSchemaType } from "ajv";

import { RosterLockV1PieceMetadata } from "@roster-lock/types";


export const rosterLockPieceMetadataSchema: JSONSchemaType<RosterLockV1PieceMetadata> = {
  type: "object",
  required: ["configPurpose", "configVersion", "humanInfo", "downloadSources", "pathVariables"],
  additionalProperties: false,
  properties: {
    configPurpose: { type: "string", const: "piece-meta" },
    configVersion: { type: "number", const: 1 },
    humanInfo: humanInfoSchema,
    downloadSources: downloadableSourcesSchema,
    pathVariables: pathVariablesSchema,
  },
}

