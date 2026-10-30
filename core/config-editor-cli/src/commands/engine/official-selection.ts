import { Command } from "commander";
import { ROSTERLOCK_V1_CASTER_JSONSCHEMA } from "@roster-lock/shared";
import { createShaFromJSON } from "@roster-lock/utils";
import { resolveDraftPath, readDraft, writeDraft } from "../../lib/draft-io";
import { withDraftOption } from "../../lib/cli-options";
import { withErrorHandling } from "../../lib/errors";

export const addOfficialSelectionCommand = withDraftOption(new Command("add-official-selection"))
  .description("Register a selection config hash under a tag the engine's own UI can recognise")
  .argument("<tag>", "the tag the engine matches to one of its selection screens, e.g. \"single\" or \"3v3-tag\"")
  .option(
    "--hash <sha256>",
    "the selection config's hash (from \"selection hash\"); defaults to hashing the draft's current selection"
  )
  .action(withErrorHandling(async (tag: string, opts: { draft?: string, hash?: string }) => {
    const draftPath = resolveDraftPath(opts.draft);
    const draft = readDraft(draftPath);

    // Registering by explicit --hash is the normal case for an engine offering
    // several selection configs: each one lives in its own published lock, so
    // every lock has to list all of the hashes, not just the one it carries.
    const hash = opts.hash ?? await createShaFromJSON(draft.stagedLock.selection);

    const list = draft.stagedLock.engine.officialSelections ??= [];
    const existing = list.find((entry) => entry.hash === hash);
    if(existing){
      if(existing.tag === tag){
        console.log(`Already registered: ${tag} ${hash}`);
        return;
      }
      throw new Error(
        `Hash ${hash} is already registered under tag "${existing.tag}"; ` +
        "a selection config can only carry one tag"
      );
    }

    list.push({ tag, hash });
    ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast(draft.stagedLock);

    writeDraft(draftPath, draft);
    console.log(`Registered official selection: ${tag} ${hash}`);
  }));
