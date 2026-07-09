import { Command } from "commander";
import { resolveDraftPath, readDraft } from "../../lib/draft-io";
import { withDraftOption } from "../../lib/cli-options";
import { withErrorHandling } from "../../lib/errors";

export const selectionShowCommand = withDraftOption(new Command("show"))
  .description("Print the staged lock's selection config")
  .action(withErrorHandling(async (opts: { draft?: string }) => {
    const draftPath = resolveDraftPath(opts.draft);
    const draft = readDraft(draftPath);
    console.log(JSON.stringify(draft.stagedLock.selection, null, 2));
  }));
