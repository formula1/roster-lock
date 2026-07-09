import { Command } from "commander";
import { ROSTERLOCK_V1_CASTER_JSONSCHEMA, diffLocks } from "@roster-lock/shared";
import { cloneJSON } from "@roster-lock/utils";
import { resolveDraftPath, readDraft } from "../../lib/draft-io";
import { writeLock } from "../../lib/lock-io";
import { withDraftOption } from "../../lib/cli-options";
import { withErrorHandling } from "../../lib/errors";
import { printSemverReasons } from "../../lib/semver-report";

export const publishCommand = withDraftOption(new Command("publish"))
  .description("Publish the staged lock as a standalone, versioned lock file (does not modify the draft)")
  .argument("<outLockPath>", "where to write the published lock file")
  .action(withErrorHandling(async (outLockPath: string, opts: { draft?: string }) => {
    const draftPath = resolveDraftPath(opts.draft);
    const draft = readDraft(draftPath);

    const stagedLock = cloneJSON(draft.stagedLock);
    ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast(stagedLock);

    const semver = diffLocks(draft.previousLock, stagedLock);
    stagedLock.version = semver.toString();

    writeLock(outLockPath, stagedLock);
    printSemverReasons(semver);
    console.log(`Published: ${outLockPath}`);
  }));
