import { JSONSchemaType } from "ajv";
import { selectionPieceMetaSchema } from "../meta";
import { SelectionUnselectableConfig } from "@roster-lock/types/src/v1/lock/selection/selection-types/unselectable";

export const unselectableSelectionSchema: JSONSchemaType<SelectionUnselectableConfig> = {
  type: "object",
  required: ["type"],
  additionalProperties: false,
  properties: {
    type: { type: "string", const: "unselectable" },
    pieceMeta: selectionPieceMetaSchema,
  },
};
