
import { JSONSchemaType } from "ajv";
import { RosterLockV1Config, SelectionPreselectedConfig } from "@roster-lock/types";
import { selectionPieceMetaSchema } from "../meta";
import { validatePreselected } from "../../validate/selections/preselected";
import { defineKeyword } from "../../../../../../util-types/json-schema";

export const preselectedSchemaValidator = defineKeyword({
  keyword: "preselected",
  type: "object",
  validate: function (
    selection: SelectionPreselectedConfig["pieces"],
    config: RosterLockV1Config,
    path
  ){
    // /selection/piece/pieceType/pieces
    const pieceType = path.split("/").at(-2);
    if(!pieceType) throw new Error("Invalid path");
    validatePreselected(selection, pieceType, config);
  }
});

export const preselectedSelectionSchema = {
  type: "object",
  required: ["type", "pieces"],
  additionalProperties: false,
  $defs: {
    PreselectedPiece: {
      type: "object",
      required: ["id", "required"],
      additionalProperties: false,
      properties: {
        id: { type: "string" },
        required: {
          type: "object",
          required: [],
          additionalProperties: {
            type: "array",
            items: { $ref: "#/$defs/PreselectedPiece" },
          },
        },
      },
    },
  },
  properties: {
    type: { type: "string", const: "preselected" },
    pieceMeta: { ...selectionPieceMetaSchema, nullable: true },
    pieces: {
      type: "array",
      [preselectedSchemaValidator.keyword]: true,
      items: { $ref: "#/$defs/PreselectedPiece" },
    },
  },
} as unknown as JSONSchemaType<SelectionPreselectedConfig>;
