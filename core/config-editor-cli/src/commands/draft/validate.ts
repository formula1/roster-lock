import { Command } from "commander";
import { ROSTERLOCK_V1_CASTER_JSONSCHEMA } from "@roster-lock/shared";
import { resolveDraftPath, readDraft } from "../../lib/draft-io";
import { withDraftOption } from "../../lib/cli-options";
import { formatError } from "../../lib/errors";

export const draftValidateCommand = withDraftOption(new Command("validate"))
  .description(
    "Report every issue blocking \"draft publish\"/\"draft promote\": runs the staged lock through the full " +
    "(non-draft) schema and lists all failures at once, without writing anything"
  )
  .action(async (opts: { draft?: string }) => {
    try {
      const draftPath = resolveDraftPath(opts.draft);
      const draft = readDraft(draftPath);

      const result = ROSTERLOCK_V1_CASTER_JSONSCHEMA.safeCast(draft.stagedLock);
      if(result.valid){
        console.log("OK: staged lock is valid and ready to publish");
        return;
      }

      console.error(`${result.error.length} issue(s) found in staged lock:`);
      console.error(formatError(result.error));
      process.exitCode = 1;
    } catch(e){
      console.error(formatError(e));
      process.exitCode = 1;
    }
  });
