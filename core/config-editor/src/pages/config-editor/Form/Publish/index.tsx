import { RosterLockV1Draft } from "@roster-lock/types";
import { ROSTERLOCK_V1_CASTER_JSONSCHEMA } from "@roster-lock/shared";
import { cloneJSON, } from "@roster-lock/utils";
import { showSaveDialog } from "../../../../tauri/window";
import { diffLocks } from "./diffRosters";
import { fs } from "../../../../tauri/fs";
import { join as pathJoin, dirname } from "path-browserify";

export async function publishStagedLock(draft: RosterLockV1Draft, draftFilePath?: string){
  const stagedLock = cloneJSON(draft.stagedLock);
  ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast(stagedLock);

  const defaultDir = (
    !draftFilePath ? await fs.getMatchLockDir() :
    dirname(draftFilePath)
  );
  const { canceled, filePath } = await showSaveDialog({
    title: "Publish new Roster Lock file",
    defaultPath: pathJoin(defaultDir, `${stagedLock.title}-${stagedLock.version}.rosterlock.json`),
    filters: [
      { name: 'JSON Files', extensions: ['json'] }
    ]
  });

  if(canceled) return null;
  if(!filePath) return null;

  const semver = diffLocks(draft.previousLock, stagedLock);
  stagedLock.version = semver.toString();

  await fs.writeJSON(filePath, stagedLock)
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

export { diffLocks };
