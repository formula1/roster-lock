import { Command } from "commander";
import { ROSTERLOCK_V1_CASTER_JSONSCHEMA, diffLocks } from "@roster-lock/shared";
import { cloneJSON } from "@roster-lock/utils";
import { resolveDraftPath, readDraft, writeDraft } from "../../lib/draft-io";
import { withDraftOption } from "../../lib/cli-options";
import { withErrorHandling } from "../../lib/errors";
import { printSemverReasons } from "../../lib/semver-report";

export const promoteCommand = withDraftOption(new Command("promote"))
  .description("Move the staged lock forward as the new baseline (previousLock) for future diffs")
  .action(withErrorHandling(async (opts: { draft?: string }) => {
    const draftPath = resolveDraftPath(opts.draft);
    const draft = readDraft(draftPath);

    const updatedDraft = cloneJSON(draft);
    ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast(updatedDraft.stagedLock);

    const semver = diffLocks(updatedDraft.previousLock, updatedDraft.stagedLock);
    updatedDraft.stagedLock.version = semver.toString();
    updatedDraft.previousLock = cloneJSON(updatedDraft.stagedLock);

    writeDraft(draftPath, updatedDraft);
    printSemverReasons(semver);
  }));
