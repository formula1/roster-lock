import { JSONSchemaType } from "ajv";
import { SelectedPiece } from "@roster-lock/types";

/*
type SelectedPiece = {
    id: string;
    required: Record<string, {
        mandatory: Array<SelectedPiece>;
        selectable: Array<SelectedPiece>;
    }>;
}
*/

export const SelectedPieceSchemaDef = {
  $defs: {
    SelectedPiece: {
      type: "object",
      required: ["id", "required"],
      additionalProperties: false,
      properties: {
        id: { type: "string" },
        required: {
          type: "object",
          required: [],
          additionalProperties: {
            type: "object",
            required: ["mandatory", "selectable"],
            additionalProperties: false,
            properties: {
              mandatory: {
                type: "array",
                items: { $ref: "#/$defs/SelectedPiece" },
              },
              selectable: {
                type: "array",
                items: { $ref: "#/$defs/SelectedPiece" },
              }
            }
          },
        },
      },
    },
  },
};

// AJV's JSONSchemaType doesn't support $ref-only schemas; cast is safe at runtime
export const SelectedPieceSchema = {
  $ref: "#/$defs/SelectedPiece"
} as unknown as JSONSchemaType<SelectedPiece>;