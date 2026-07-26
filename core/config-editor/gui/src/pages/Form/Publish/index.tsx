import { RosterLockV1Draft } from "@roster-lock/types";
import { ROSTERLOCK_V1_CASTER_JSONSCHEMA, diffLocks } from "@roster-lock/shared";
import { cloneJSON, } from "@roster-lock/utils";

// Builds the lock that should be published from the draft's staged lock.
// Persisting it (native save dialog, browser download, ...) is the host's
// concern - hand the result to ConfigContext's publish().
export function buildStagedLock(draft: RosterLockV1Draft){
  const stagedLock = cloneJSON(draft.stagedLock);
  ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast(stagedLock);

  const semver = diffLocks(draft.previousLock, stagedLock);
  stagedLock.version = semver.toString();
  return stagedLock;
}

export function promoteStagedLock(draft: RosterLockV1Draft): RosterLockV1Draft {
  const updatedDraft = cloneJSON(draft);
  ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast(updatedDraft.stagedLock);

  const semver = diffLocks(updatedDraft.previousLock, updatedDraft.stagedLock);
  updatedDraft.stagedLock.version = semver.toString();

  updatedDraft.previousLock = cloneJSON(updatedDraft.stagedLock);
  return updatedDraft;
}
