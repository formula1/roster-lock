import { ROSTERLOCK_V1_CASTER_JSONSCHEMA, ROSTERLOCK_V1_DRAFT_CASTER_JSONSCHEMA, EMPTY_ROSTER_DRAFT } from "@roster-lock/shared";
import { RosterLockV1Draft } from "@roster-lock/types";

import { createCurrentFileContext } from "../../../../components/data/CurrentFileContext";

const {
  useCurrentFile: useCurrentRosterLockFile,
  CurrentFileProvider: CurrentRosterLockFileProvider,
} = createCurrentFileContext<RosterLockV1Draft>(
  EMPTY_ROSTER_DRAFT,
  (json)=>{
    if(typeof json !== "object" || Array.isArray(json) || json === null){
      throw new Error("File is not a valid draft or lock file")
    }
    return ROSTERLOCK_V1_DRAFT_CASTER_JSONSCHEMA.cast(json, false)
  }
);

export { useCurrentRosterLockFile, CurrentRosterLockFileProvider };

