import { z } from "zod";

// Shape validation for JSON loaded via --json flags, before it's merged into the
// staged lock. This is deliberately looser than the full lock schema in
// @roster-lock/shared (AJV/JSON-schema, which also encodes cross-field domain
// rules like requirement cycles or piece-meta consistency) - it exists to give a
// fast, readable error for a malformed CLI argument, before that full check runs
// against the whole staged lock.

const countSchema = z.union([
  z.number().int(),
  z.literal("*"),
  z.tuple([z.number().int(), z.union([z.number().int(), z.literal("*")])]),
]);

const assetSchema = z.object({
  name: z.string(),
  classification: z.enum(["logic", "media", "doc"]),
  count: countSchema,
  glob: z.array(z.string()),
}).strict();

export const pieceDefinitionSchema = z.object({
  selectionStrategy: z.enum(["mandatory", "personal", "shared", "on demand"]),
  requires: z.array(z.string()),
  pathVariables: z.array(z.string()),
  assets: z.array(assetSchema),
}).strict();

const pieceHumanInfoSchema = z.object({
  name: z.string(),
  author: z.string(),
  url: z.string(),
  image: z.string().optional(),
}).strict();

// Used by "roster add-piece"/"roster edit-piece" --json: an alternative to the
// discrete --path-variables/--download-source/--name/etc flags. Only covers
// additive fields (set humanInfo, add downloadSources/pathVariables) - removing a
// download source or path variable still requires edit-piece's discrete flags.
export const pieceOverridesSchema = z.object({
  humanInfo: pieceHumanInfoSchema.optional(),
  downloadSources: z.array(z.string()).optional(),
  pathVariables: z.record(z.string(), z.string()).optional(),
}).strict();

// Used by "media-override add"/"media-override edit" --json: same additive-only
// shape convention as pieceOverridesSchema. `assets` is additive here too - to
// remove an asset from an override's declared set, rescan after editing it out
// of the folder rather than editing the list directly (removing one without a
// rescan would leave the entry's hash stale for files that used to matter).
export const mediaOverrideEntryOverridesSchema = z.object({
  name: z.string().optional(),
  assets: z.array(z.string()).optional(),
  downloadSources: z.array(z.string()).optional(),
}).strict();

const untrustedScriptRefSchema = z.object({
  src: z.string(),
  method: z.string().optional(),
}).strict();

const jsonShallowValueSchema = z.union([
  z.string(), z.number(), z.boolean(),
  z.array(z.string()), z.array(z.number()), z.array(z.boolean()),
]);
const jsonShallowObjectSchema = z.record(z.string(), jsonShallowValueSchema);

// Used by "piece-meta set" --json: the top-level per-piece-type custom fields
// (kept separate from the selection config so a selection config stays roster-agnostic).
export const pieceMetaOverridesSchema = z.object({
  schema: z.record(z.string(), z.enum(["boolean", "number", "string", "boolean[]", "number[]", "string[]"])).optional(),
  defaultMeta: jsonShallowObjectSchema.optional(),
  // Record<PieceId, Partial<Config>> - a record's values are already independently
  // optional per key, so this is the same shape as the record itself.
  values: z.record(z.string(), jsonShallowObjectSchema).optional(),
}).strict();

type SelectedPieceInput = {
  id: string,
  mediaOverrides?: Array<string>,
  required: Record<string, { mandatory: Array<SelectedPieceInput>, selectable: Array<SelectedPieceInput> }>,
};
const selectedPieceSchema: z.ZodType<SelectedPieceInput> = z.lazy(() => z.object({
  id: z.string(),
  mediaOverrides: z.array(z.string()).optional(),
  required: z.record(z.string(), z.object({
    mandatory: z.array(selectedPieceSchema),
    selectable: z.array(selectedPieceSchema),
  }).strict()),
}).strict());

const userSelectionValidationSchema = z.object({
  count: countSchema,
  unique: z.boolean(),
  banList: z.array(z.string()),
  customValidation: z.array(untrustedScriptRefSchema),
}).strict();

// Keyed by the `--type` option on "selection set"; each schema covers the fields
// mergeable on top of that type's template (its own template already supplies
// `type`, so it stays optional here).
export const selectionOverridesSchemas = {
  normal: z.object({
    validation: userSelectionValidationSchema.optional(),
    mergeAlgorithm: untrustedScriptRefSchema.optional(),
  }).strict(),
  preselected: z.object({
    pieces: z.array(selectedPieceSchema).optional(),
  }).strict(),
  unselectable: z.object({}).strict(),
  "game-controlled": z.object({}).strict(),
} as const;
