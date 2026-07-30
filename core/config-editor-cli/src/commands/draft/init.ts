import { Command } from "commander";
import { resolve } from "node:path";
import { EMPTY_ROSTER_DRAFT } from "@roster-lock/shared";
import { cloneJSON } from "@roster-lock/utils";
import { defaultDraftPath, writeDraft } from "../../lib/draft-io";
import { withErrorHandling } from "../../lib/errors";

export const initCommand = new Command("init")
  .description("Create a new empty roster-lock draft")
  .argument("[draftPath]", "where to write the draft (defaults to a name derived from --title)")
  .option("--title <title>", "title to seed the staged lock with")
  .option("--author <author>", "author to seed the staged lock with")
  .action(withErrorHandling(async (draftPath: string | undefined, opts: { title?: string, author?: string }) => {
    const draft = cloneJSON(EMPTY_ROSTER_DRAFT);
    if(opts.title) draft.stagedLock.title = opts.title;
    if(opts.author) draft.stagedLock.author = opts.author;

    const path = draftPath ? resolve(process.cwd(), draftPath) : defaultDraftPath(opts.title);
    writeDraft(path, draft);
    console.log(`Created draft: ${path}`);
  }));
