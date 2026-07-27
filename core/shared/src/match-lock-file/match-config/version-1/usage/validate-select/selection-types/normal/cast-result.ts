import { SelectedPiece, PlayerId } from "@roster-lock/types";
import Ajv from "ajv";
import { SelectedPieceSchema, SelectedPieceSchemaDef } from "../../../../shared/SelectedPiece";

const ajv = new Ajv({ allErrors: true, strict: true, allowUnionTypes: true });

ajv.addSchema({
  $id: "SelectedPiece",
  ...SelectedPieceSchemaDef,
  ...SelectedPieceSchema,
});

const validateShared = ajv.compile<Array<SelectedPiece>>({
  type: "array",
  items: { $ref: "SelectedPiece" },
});

const validatePersonal = ajv.compile<Record<PlayerId, Array<SelectedPiece>>>({
  type: "object",
  required: [],
  additionalProperties: {
    type: "array",
    items: { $ref: "SelectedPiece" },
  },
});

export function castSharedResult(value: unknown): Array<SelectedPiece> {
  if (!validateShared(value)) {
    throw validateShared.errors;
  }
  return value;
}

export function castPersonalResult(value: unknown): Record<PlayerId, Array<SelectedPiece>> {
  if (!validatePersonal(value)) {
    throw validatePersonal.errors;
  }
  return value;
}
