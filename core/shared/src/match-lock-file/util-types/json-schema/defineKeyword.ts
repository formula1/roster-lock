import { SchemaValidateFunction } from "ajv";
import { SafeKeyword } from "./safe-keyword";
import { JSONSchemaType } from "./schema-types";

export type AJVKeywordDefinition<K extends string = string> = {
  keyword: SafeKeyword<K>,
  type?: JSONSchemaType,
  validate: SchemaValidateFunction
};

export function defineKeyword<T, K extends string>(
  definition: {
    keyword: SafeKeyword<K>,
    type?: JSONSchemaType,
    validate: (v: any, engine: T, path: string)=>unknown
  }
): AJVKeywordDefinition<K>{
  return {
    ...definition, validate: wrapValidator<T>(definition.keyword, definition.validate)
  };
}

function wrapValidator<T>(
  keyword: string,
  validator: (v: any, engine: T, path: string)=>unknown
): SchemaValidateFunction {
  const wrapped: SchemaValidateFunction = function(
    _schema,
    value: any,
    _parentSchema,
    dataCxt,
  ){
    if(!dataCxt) return true;
    try {
      validator(value, dataCxt.rootData as T, dataCxt.instancePath);
      return true;
    }catch(e: any){
      wrapped.errors = [{
        instancePath: dataCxt.instancePath,
        schemaPath: "",
        keyword: keyword,
        message: e.message,
        params: {}
      }]
      return false;
    }
  }
  return wrapped;
}

