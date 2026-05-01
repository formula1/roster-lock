import { SelectedPiece, UserId } from "@roster-lock/types";
import Ajv from "ajv";

const ajv = new Ajv({ allErrors: true, strict: true, allowUnionTypes: true });

ajv.addSchema({
  $id: "SelectedPiece",
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
        items: { $ref: "SelectedPiece" },
      },
    },
  },
});

const validateShared = ajv.compile<Array<SelectedPiece>>({
  type: "array",
  items: { $ref: "SelectedPiece" },
});

const validatePersonal = ajv.compile<Record<UserId, Array<SelectedPiece>>>({
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

export function castPersonalResult(value: unknown): Record<UserId, Array<SelectedPiece>> {
  if (!validatePersonal(value)) {
    throw validatePersonal.errors;
  }
  return value;
}
