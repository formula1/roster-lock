import { ROSTERLOCK_V1_CASTER_JSONSCHEMA, ROSTERLOCK_V1_DRAFT_CASTER_JSONSCHEMA } from "@roster-lock/shared";
import { RosterLockV1Draft } from "@roster-lock/types";

import { createCurrentFileContext } from "../../../../components/data/CurrentFileContext";

const {
  useCurrentFile: useCurrentRosterLockFile,
  CurrentFileProvider: CurrentRosterLockFileProvider,
} = createCurrentFileContext<RosterLockV1Draft>(
  {
    configPurpose: "draft",
    configVersion: 1,
    previousVersion: "0.0.0",
    stagedLock: {
      configPurpose: "lock",
      configVersion: 1,
      author: "",
      title: "",
      version: "draft",
      engine: { name: "", version: "", pieceDefinitions: {} },
      rosters: {},
      selection: { piece: {} },
    },
    draftPieceInfo: {}
  },
  (json)=>{
    if(typeof json !== "object" || Array.isArray(json) || json === null){
      throw new Error("File is not a valid draft or lock file")
    }
    if(!("configPurpose" in json)){
      throw new Error("File is not a valid draft or lock file")
    }
    if(json.configPurpose === "draft"){
      return ROSTERLOCK_V1_DRAFT_CASTER_JSONSCHEMA.cast(json)
    }
    if(json.configPurpose === "lock"){
      const lockFile = ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast(json);
      return {
        configPurpose: "draft",
        configVersion: 1,
        previousVersion: lockFile.version,
        previousLock: lockFile,
        stagedLock: lockFile,
        draftPieceInfo: {}
      } satisfies RosterLockV1Draft
    }
    throw new Error("File is not a valid draft or lock file")
  }
);

export { useCurrentRosterLockFile, CurrentRosterLockFileProvider };

