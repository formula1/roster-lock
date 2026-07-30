import { Command } from "commander";
import { ZodType } from "zod";
import {
  ROSTERLOCK_V1_CASTER_JSONSCHEMA,
  EMPTY_ROSTER_NORMAL_SELECTION,
  EMPTY_ROSTER_PRESELECTED_SELECTION,
  EMPTY_ROSTER_UNSELECTABLE_SELECTION,
  EMPTY_ROSTER_GAME_SELECTION,
} from "@roster-lock/shared";
import { cloneJSON } from "@roster-lock/utils";
import { resolveDraftPath, readDraft, writeDraft } from "../../lib/draft-io";
import { withDraftOption } from "../../lib/cli-options";
import { withErrorHandling } from "../../lib/errors";
import { readJsonInput } from "../../lib/json-input";
import { selectionOverridesSchemas } from "../../lib/schemas";
import { describeSchemaShape } from "../../lib/schema-help";

const TEMPLATES = {
  normal: EMPTY_ROSTER_NORMAL_SELECTION,
  preselected: EMPTY_ROSTER_PRESELECTED_SELECTION,
  unselectable: EMPTY_ROSTER_UNSELECTABLE_SELECTION,
  "game-controlled": EMPTY_ROSTER_GAME_SELECTION,
} as const;

const JSON_SHAPE_BY_TYPE = Object.entries(selectionOverridesSchemas)
  .map(([type, schema]) => `${type}: ${describeSchemaShape(schema)}`)
  .join("; ");

export const selectionSetCommand = withDraftOption(new Command("set"))
  .description("Set the selection config for a piece type")
  .argument("<pieceType>", "the piece type key")
  .requiredOption("--type <type>", "normal|preselected|unselectable|game-controlled")
  .option(
    "--json <file>",
    "type-specific fields to merge in, read from a JSON file (or \"-\" for stdin); shape depends on --type. " +
    `Shapes: ${JSON_SHAPE_BY_TYPE}`
  )
  .action(withErrorHandling(async (pieceType: string, opts: { draft?: string, type: string, json?: string }) => {
    const draftPath = resolveDraftPath(opts.draft);
    const draft = readDraft(draftPath);

    const template = TEMPLATES[opts.type as keyof typeof TEMPLATES];
    if(!template) throw new Error(`Invalid --type "${opts.type}" (expected normal|preselected|unselectable|game-controlled)`);

    const overridesSchema = selectionOverridesSchemas[opts.type as keyof typeof selectionOverridesSchemas] as (
      ZodType<Record<string, unknown>>
    );
    const overrides = opts.json ? await readJsonInput(opts.json, overridesSchema) : {};
    draft.stagedLock.selection.piece[pieceType] = { ...cloneJSON(template), ...overrides };

    ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast(draft.stagedLock);
    writeDraft(draftPath, draft);
    console.log(`Set selection for "${pieceType}" to "${opts.type}"`);
  }));
