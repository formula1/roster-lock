import { Command } from "commander";
import { resolve } from "node:path";
import { EMPTY_ROSTER_DRAFT } from "@roster-lock/shared";
import { cloneJSON } from "@roster-lock/utils";
import { readLock } from "../../lib/lock-io";
import { defaultDraftPath, writeDraft } from "../../lib/draft-io";
import { withErrorHandling } from "../../lib/errors";

export const fromLockCommand = new Command("from-lock")
  .description("Create a new draft from an existing published lock file")
  .argument("<lockPath>", "path to the published lock file")
  .argument("[draftPath]", "where to write the draft (defaults to a name derived from the lock's title)")
  .option(
    "--clear-rosters",
    "keep the lock's engine config, but start with empty rosters and no per-piece-type selection config"
  )
  .action(withErrorHandling(async (lockPath: string, draftPath: string | undefined, opts: { clearRosters?: boolean }) => {
    const lock = readLock(lockPath);

    const draft = cloneJSON(EMPTY_ROSTER_DRAFT);
    draft.previousLock = cloneJSON(lock);
    draft.stagedLock = cloneJSON(lock);

    if(opts.clearRosters){
      for(const pieceType of Object.keys(draft.stagedLock.rosters)){
        draft.stagedLock.rosters[pieceType] = [];
      }
      draft.stagedLock.selection.piece = {};
    }

    const path = draftPath ? resolve(process.cwd(), draftPath) : defaultDraftPath(lock.title);
    writeDraft(path, draft);
    console.log(`Created draft: ${path}${opts.clearRosters ? " (rosters cleared)" : ""}`);
  }));
