import { Command } from "commander";
import { ROSTERLOCK_V1_CASTER_JSONSCHEMA, EMPTY_PIECE_META } from "@roster-lock/shared";
import { cloneJSON } from "@roster-lock/utils";
import { resolveDraftPath, readDraft, writeDraft } from "../../lib/draft-io";
import { withDraftOption } from "../../lib/cli-options";
import { withErrorHandling } from "../../lib/errors";
import { readJsonInput } from "../../lib/json-input";
import { pieceMetaOverridesSchema } from "../../lib/schemas";
import { describeSchemaShape } from "../../lib/schema-help";

export const pieceMetaSetCommand = withDraftOption(new Command("set"))
  .description("Set the custom piece meta (schema/defaultMeta/values) for a piece type")
  .argument("<pieceType>", "the piece type key")
  .option(
    "--json <file>",
    "fields to merge in, read from a JSON file (or \"-\" for stdin). " +
    `Shape: ${describeSchemaShape(pieceMetaOverridesSchema)}`
  )
  .action(withErrorHandling(async (pieceType: string, opts: { draft?: string, json?: string }) => {
    const draftPath = resolveDraftPath(opts.draft);
    const draft = readDraft(draftPath);

    const overrides = opts.json ? await readJsonInput(opts.json, pieceMetaOverridesSchema) : {};
    draft.stagedLock.pieceMeta[pieceType] = { ...cloneJSON(EMPTY_PIECE_META), ...overrides };

    ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast(draft.stagedLock);
    writeDraft(draftPath, draft);
    console.log(`Set piece meta for "${pieceType}"`);
  }));
