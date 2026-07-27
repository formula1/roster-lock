import { RosterLockV1Config } from "../../lock";

import { UserSelection } from "../shared";

export type RosterLockV1SyncDLRequestUserToClient = {
  version: 1,
  relay: {
    url: string,
    roomId: string,
  },
  machine: {
    machineId: string;
    keys: {
      publicKey: string,
      privateKey: string,
    }
  },
  rosterConfig: RosterLockV1Config,
  // Keyed by local player index on this machine (0-based).
  playerSelections: Record<number, UserSelection>,
};