
import { JSONSchemaType } from "ajv";
import { RosterLockV1Config, SelectionPreselectedConfig } from "@roster-lock/types";
import { selectionPieceMetaSchema } from "../meta";
import { validatePreselected } from "../../validate/selections/preselected";
import { defineKeyword } from "../../../../../../util-types/json-schema";
import { SelectedPieceSchema, SelectedPieceSchemaDef } from "../../../../shared";

export const preselectedSchemaValidator = defineKeyword({
  keyword: "selectionPreselected",
  type: "array",
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
  $id: "preselectedSelectionSchema",
  type: "object",
  required: ["type", "pieces"],
  additionalProperties: false,
  ...SelectedPieceSchemaDef,
  properties: {
    type: { type: "string", const: "preselected" },
    pieceMeta: { ...selectionPieceMetaSchema, nullable: true },
    pieces: {
      type: "array",
      [preselectedSchemaValidator.keyword]: true,
      items: SelectedPieceSchema,
    },
  },
} as unknown as JSONSchemaType<SelectionPreselectedConfig>;
