

import { Validator } from "jsonschema";
import { JSONSchemaType } from "ajv";
import { AJVKeywordDefinition, AttributeValidateFunction, OptionsWithRootData } from "./defineKeyword";

// A passing attribute function returns a falsy value (see jsonschema's
// validateSchema: `if (validatorErr) result.importErrors(...)`) - the
// library's own CustomProperty type just doesn't admit `undefined` as one.
const returnValid: AttributeValidateFunction = () => undefined as unknown as string;

function createValidatorInstance<T>(
  engineKeywords: Array<AJVKeywordDefinition>,
  validate: boolean = true
){
  const validator = new Validator();
  for(const keyword of engineKeywords){
    validator.attributes[keyword.keyword] = !validate ? returnValid : keyword.validate;
  }
  return validator;
}

type SafeValue<T> = (
  | { valid: true, value: T }
  | { valid: false, error: Array<{ message?: string }> }
);

export class JSONSchemaCaster<T> {
  constructor(
    private schema: JSONSchemaType<T>,
    private keywords: Array<AJVKeywordDefinition>,
  ){}

  safeCast(input: unknown, validate: boolean = true): SafeValue<T> {
    try {
      return { valid: true, value: this.cast(input, validate) };
    }catch(e){
      return { valid: false, error: e as Array<{ message?: string }> };
    }
  }

  cast(input: unknown, validate: boolean = true) {
    const validator = createValidatorInstance(this.keywords, validate);
    // rootData: jsonschema's ctx has no equivalent of ajv's dataCxt.rootData,
    // so the top-level instance is threaded through options for keyword
    // validators (like path-variables') that need to look at sibling data
    // (e.g. engine.pieceDefinitions) rather than just the current node.
    // nestedErrors: without it, anyOf (used by nullable()) collapses a
    // failing branch's specific error messages (e.g. a custom keyword's
    // "Duplicate official selection hash X") into a generic "is not any
    // of [...]" message instead of surfacing them.
    const options: OptionsWithRootData<unknown> = { rootData: input, nestedErrors: true };
    const result = validator.validate(input, this.schema as object, options);
    if(!result.valid){
      throw result.errors;
    }
    return input as T;
  }
}
