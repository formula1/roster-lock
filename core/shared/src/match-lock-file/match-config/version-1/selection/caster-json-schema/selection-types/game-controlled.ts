import { JSONSchemaType } from "ajv";
import { SelectionGameControlledConfig } from "@roster-lock/types";
import { selectionPieceMetaSchema } from "../meta";

export const gameControlledSelectionSchema: JSONSchemaType<SelectionGameControlledConfig> = {
  type: "object",
  required: ["type"],
  additionalProperties: false,
  properties: {
    type: { type: "string", const: "game-controlled" },
    pieceMeta: { ...selectionPieceMetaSchema, nullable: true },
  },
}
