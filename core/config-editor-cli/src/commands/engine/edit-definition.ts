import { Command } from "commander";
import { ROSTERLOCK_V1_CASTER_JSONSCHEMA, validatePieceDefinition } from "@roster-lock/shared";
import { RosterLockV1Config } from "@roster-lock/types";
import { resolveDraftPath, readDraft, writeDraft } from "../../lib/draft-io";
import { withDraftOption } from "../../lib/cli-options";
import { withErrorHandling } from "../../lib/errors";
import { parseCommaList, parseStrategy } from "../../lib/parse";
import { readJsonInput } from "../../lib/json-input";
import { pieceDefinitionSchema } from "../../lib/schemas";
import { describeSchemaShape } from "../../lib/schema-help";

type PieceDefinition = RosterLockV1Config["engine"]["pieceDefinitions"][string];

export const editDefinitionCommand = withDraftOption(new Command("edit-definition"))
  .description(
    "Edit an existing piece type's selection strategy, requires, or path variables " +
    "(use \"engine add-asset\"/\"remove-asset\" to change assets)"
  )
  .argument("<pieceType>", "the piece type key")
  .option("--strategy <strategy>", "mandatory|personal|shared|on-demand")
  .option("--requires <types>", "comma-separated list of required on-demand piece types (replaces the existing list)")
  .option("--path-variables <names>", "comma-separated list of path variable names (replaces the existing list)")
  .option(
    "--json <file>",
    "replace the full piece-type definition (including assets) from a JSON file (or \"-\" for stdin), instead of the flags above. " +
    `Shape: ${describeSchemaShape(pieceDefinitionSchema)}`
  )
  .action(withErrorHandling(async (pieceType: string, opts: {
    draft?: string, strategy?: string, requires?: string, pathVariables?: string, json?: string
  }) => {
    const draftPath = resolveDraftPath(opts.draft);
    const draft = readDraft(draftPath);

    const existing = draft.stagedLock.engine.pieceDefinitions[pieceType];
    if(!existing) throw new Error(`Unknown piece type "${pieceType}"; define it first with "engine add-piece-type"`);

    let definition: PieceDefinition;
    if(opts.json){
      definition = await readJsonInput(opts.json, pieceDefinitionSchema);
    } else {
      if(opts.strategy === undefined && opts.requires === undefined && opts.pathVariables === undefined){
        throw new Error("Nothing to change; pass --strategy, --requires, --path-variables, or --json");
      }
      definition = {
        ...existing,
        selectionStrategy: opts.strategy !== undefined ? parseStrategy(opts.strategy) : existing.selectionStrategy,
        requires: opts.requires !== undefined ? parseCommaList(opts.requires) : existing.requires,
        pathVariables: opts.pathVariables !== undefined ? parseCommaList(opts.pathVariables) : existing.pathVariables,
      };
    }

    draft.stagedLock.engine.pieceDefinitions[pieceType] = definition;
    validatePieceDefinition(pieceType, definition, draft.stagedLock.engine);
    ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast(draft.stagedLock);

    writeDraft(draftPath, draft);
    console.log(`Updated piece type: ${pieceType}`);
  }));
