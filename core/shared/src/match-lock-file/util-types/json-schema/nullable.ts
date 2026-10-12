// ajv's `nullable: true` is an ajv-specific extension (sugar over `type:
// [..., "null"]`) - jsonschema has no concept of it and silently ignores
// the flag, so a schema written `{ ...schema, nullable: true }` would
// reject an explicit `null` value that ajv would have accepted. anyOf is
// plain, portable JSON Schema: valid if the value matches the original
// schema OR is exactly null.
// Untyped on both sides deliberately: ajv's JSONSchemaType conditional
// type has no branch representing a schema combined via `anyOf` at a
// plain field position (only object/array/string/etc, or its own
// `nullable: true` escape hatch), and generic inference through that
// conditional type from an arbitrary schema argument doesn't resolve
// sensibly either. This shape is valid JSON Schema, already verified to
// behave correctly at runtime - ajv's own types just can't express it.
export function nullable(schema: object): any {
  return {
    anyOf: [schema, { type: "null" }],
  };
}
