

import { Ajv, ErrorObject, JSONSchemaType } from "ajv";
import { AJVKeywordDefinition } from "./defineKeyword";

function returnTrue(){ return true; }
function createAJVInstance<T>(
  engineSchema: JSONSchemaType<T>,
  engineKeywords: Array<AJVKeywordDefinition>,
  validate: boolean = true
){
  const ajv = new Ajv({ allErrors: true, strict: true, allowUnionTypes: true });
  for(const keyword of engineKeywords){
    ajv.addKeyword({
      keyword: keyword.keyword,
      errors: true,
      schema: true,
      type: keyword.type,
      validate: !validate ? returnTrue : keyword.validate,
    });
  }
  return ajv.compile(engineSchema);
}

type SafeValue<T> = (
  | { valid: true, value: T }
  | { valid: false, error: Array<ErrorObject> }
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
      return { valid: false, error: e as Array<ErrorObject> };
    }
  }

  cast(input: unknown, validate: boolean = true) {
    const schemaValidator = createAJVInstance(this.schema, this.keywords, validate);
    if(!schemaValidator(input)){
      if(!schemaValidator.errors) throw new Error("Validation failed with no information");
      throw schemaValidator.errors;
    }
    return input as T;
  }
}
