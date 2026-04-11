import { ROSTERLOCK_V1_CASTER_JSONSCHEMA } from "@roster-lock/shared";
import { RosterLockV1Config } from "@roster-lock/types";

import { createCurrentFileContext } from "../../../../components/data/CurrentFileContext";

const {
  useCurrentFile: useCurrentRosterLockFile,
  CurrentFileProvider: CurrentRosterLockFileProvider,
} = createCurrentFileContext<RosterLockV1Config>(
  {
    version: 1,
    engine: { name: "", version: "", pieceDefinitions: {} },
    rosters: {},
    selection: { piece: {} },
  },
  ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast
);

export { useCurrentRosterLockFile, CurrentRosterLockFileProvider };

