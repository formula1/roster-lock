import { SelectedPiece, PlayerId } from "@roster-lock/types";
import { Validator } from "jsonschema";
import { SelectedPieceSchemaDef } from "../../../../shared/SelectedPiece";

// jsonschema's addSchema/$ref resolution runs ids through the URL
// constructor - a bare word like "SelectedPiece" isn't a valid URL and
// throws "Invalid URL", so this needs to look like one (unlike ajv, which
// accepts any string as a schema $id).
const SELECTED_PIECE_SCHEMA_ID = "https://roster-lock.internal/schemas/SelectedPiece";
// Points past the $id straight at the $defs entry. Registering the schema
// with a top-level $ref (i.e. spreading in SelectedPieceSchema, which is
// just `{ $ref: "#/$defs/SelectedPiece" }`) doesn't work here: jsonschema's
// scanner treats any schema object with a top-level $ref as a pointer, not
// a document, and never indexes its $id at all - so reference the $defs
// entry's full path directly instead of going through that alias.
const SELECTED_PIECE_REF = `${SELECTED_PIECE_SCHEMA_ID}#/$defs/SelectedPiece`;

function createValidator(){
  const validator = new Validator();

  validator.addSchema({
    $id: SELECTED_PIECE_SCHEMA_ID,
    ...SelectedPieceSchemaDef,
  }, SELECTED_PIECE_SCHEMA_ID);

  return validator;
}

export function castSharedResult(value: unknown): Array<SelectedPiece> {
  const validator = createValidator();
  const result = validator.validate(value, {
    type: "array",
    items: { $ref: SELECTED_PIECE_REF },
  });
  if(!result.valid){
    throw result.errors;
  }
  return value as Array<SelectedPiece>;
}

export function castPersonalResult(value: unknown): Record<PlayerId, Array<SelectedPiece>> {
  const validator = createValidator();
  const result = validator.validate(value, {
    type: "object",
    required: [],
    additionalProperties: {
      type: "array",
      items: { $ref: SELECTED_PIECE_REF },
    },
  });
  if(!result.valid){
    throw result.errors;
  }
  return value as Record<PlayerId, Array<SelectedPiece>>;
}
