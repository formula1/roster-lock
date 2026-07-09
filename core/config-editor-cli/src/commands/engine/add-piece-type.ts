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

export const addPieceTypeCommand = withDraftOption(new Command("add-piece-type"))
  .description("Define a new piece type in the staged lock's engine")
  .argument("<pieceType>", "the piece type key")
  .option("--strategy <strategy>", "mandatory|personal|shared|on-demand")
  .option("--requires <types>", "comma-separated list of required on-demand piece types")
  .option("--path-variables <names>", "comma-separated list of path variable names")
  .option(
    "--json <file>",
    "read the full piece-type definition (including assets) from a JSON file (or \"-\" for stdin), instead of the flags above. " +
    `Shape: ${describeSchemaShape(pieceDefinitionSchema)}`
  )
  .action(withErrorHandling(async (pieceType: string, opts: {
    draft?: string, strategy?: string, requires?: string, pathVariables?: string, json?: string
  }) => {
    const draftPath = resolveDraftPath(opts.draft);
    const draft = readDraft(draftPath);

    if(draft.stagedLock.engine.pieceDefinitions[pieceType]){
      throw new Error(`Piece type "${pieceType}" already exists; use "engine remove-piece-type" first`);
    }

    const definition: PieceDefinition = opts.json
      ? await readJsonInput(opts.json, pieceDefinitionSchema)
      : {
        selectionStrategy: parseStrategy(requireOption(opts.strategy, "--strategy")),
        requires: parseCommaList(opts.requires),
        pathVariables: parseCommaList(opts.pathVariables),
        assets: [],
      };

    draft.stagedLock.engine.pieceDefinitions[pieceType] = definition;
    draft.stagedLock.rosters[pieceType] ??= [];
    validatePieceDefinition(pieceType, definition, draft.stagedLock.engine);
    ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast(draft.stagedLock);

    writeDraft(draftPath, draft);
    console.log(`Added piece type: ${pieceType}`);
  }));

function requireOption(value: string | undefined, flag: string): string {
  if(value === undefined) throw new Error(`${flag} is required unless --json is given`);
  return value;
}
