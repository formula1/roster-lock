import type { CustomProperty, Options, SchemaContext } from "jsonschema";
import { SafeKeyword } from "./safe-keyword";
import { JSONSchemaType } from "./schema-types";

// jsonschema's own shipped types omit SchemaContext.path (it exists at
// runtime - see lib/helpers.js's SchemaContext - the .d.ts just doesn't
// declare it), and Options has no concept of a root document at all. Both
// are cast to these at the one spot each is actually read/constructed,
// rather than widening the library's public types.
export type SchemaContextWithPath = SchemaContext & { path: Array<string | number> };
export type OptionsWithRootData<T> = Options & { rootData: T };

export type AttributeValidateFunction = CustomProperty;

export type AJVKeywordDefinition<K extends string = string> = {
  keyword: SafeKeyword<K>,
  type: JSONSchemaType,
  validate: AttributeValidateFunction
};

export function defineKeyword<T, K extends string>(
  definition: {
    keyword: SafeKeyword<K>,
    type: JSONSchemaType,
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
): AttributeValidateFunction {
  return function(instance, _schema, options, ctx){
    // Unlike ajv, jsonschema's "properties" keyword runs every declared
    // property's sub-schema (including custom keywords) even when that
    // property is absent and not required, passing instance=undefined.
    // ajv instead skips validation of absent optional properties entirely
    // - presence is already covered separately by the schema's "required"
    // array, so mirror ajv's behavior here rather than touching every
    // validate function to guard against an instance that was never there.
    if(instance === undefined) return undefined;
    // jsonschema's ctx carries only the path, not the root document - the
    // root instance is threaded through manually via options.rootData
    // (set once, at the top of JSONSchemaCaster.cast) since there's no
    // equivalent of ajv's dataCxt.rootData here.
    const rootData = (options as OptionsWithRootData<T>)?.rootData;
    const path = (ctx as SchemaContextWithPath).path;
    // AJV's instancePath is a real RFC 6901 JSON Pointer: a leading-slash,
    // "/"-joined string with "~" and "/" escaped *within* each segment
    // (metaPieceValue relies on this - a piece id like "@author/blue" is
    // one path segment, encoded as "@author~1blue" so it round-trips
    // through the "/"-delimited string instead of being split in two).
    const instancePath = "/" + path
      .map((segment) => String(segment).replace(/~/g, "~0").replace(/\//g, "~1"))
      .join("/");
    try {
      validator(instance, rootData, instancePath);
      return undefined;
    }catch(e: any){
      return e.message;
    }
  };
}
