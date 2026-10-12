import { Command } from "commander";
import { createShaFromJSON } from "@roster-lock/utils";
import { resolveDraftPath, readDraft } from "../../lib/draft-io";
import { withDraftOption } from "../../lib/cli-options";
import { withErrorHandling } from "../../lib/errors";

// The identity of a selection config, as referenced by
// engine.officialSelections. Hashed over the canonical form of the selection
// subtree alone, so it doesn't move when the roster or engine around it does -
// two locks that differ only in their pieces still share a selection hash.
export const selectionHashCommand = withDraftOption(new Command("hash"))
  .description("Print the sha256 of the staged lock's selection config (its officialSelections identity)")
  .action(withErrorHandling(async (opts: { draft?: string }) => {
    const draftPath = resolveDraftPath(opts.draft);
    const draft = readDraft(draftPath);
    console.log(await createShaFromJSON(draft.stagedLock.selection));
  }));
