import { Command } from "commander";
import { resolveDraftPath, readDraft, writeDraft } from "../../lib/draft-io";
import { withDraftOption } from "../../lib/cli-options";
import { withErrorHandling } from "../../lib/errors";

export const setInfoCommand = withDraftOption(new Command("set-info"))
  .description("Set the engine name/version on the staged lock")
  .option("--name <name>", "engine name")
  .option("--engine-version <version>", "engine version")
  .action(withErrorHandling(async (opts: { draft?: string, name?: string, engineVersion?: string }) => {
    const draftPath = resolveDraftPath(opts.draft);
    const draft = readDraft(draftPath);
    if(opts.name !== undefined) draft.stagedLock.engine.name = opts.name;
    if(opts.engineVersion !== undefined) draft.stagedLock.engine.version = opts.engineVersion;
    writeDraft(draftPath, draft);
    console.log(`engine: ${draft.stagedLock.engine.name}@${draft.stagedLock.engine.version}`);
  }));
