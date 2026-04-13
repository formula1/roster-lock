import { ROSTERLOCK_V1_CASTER_JSONSCHEMA, ROSTERLOCK_V1_DRAFT_CASTER_JSONSCHEMA } from "@roster-lock/shared";
import { RosterLockV1Config, RosterLockV1Draft } from "@roster-lock/types";

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
    }
  },
  ROSTERLOCK_V1_DRAFT_CASTER_JSONSCHEMA.cast
);

export { useCurrentRosterLockFile, CurrentRosterLockFileProvider };

