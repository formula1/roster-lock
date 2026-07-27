import { RosterLockV1Config } from "../../lock";

import { UserSelection } from "../shared";

export type RosterLockV1SyncDLRequestClientToAgent = {
  relay: {
    url: string,
    roomId: string,
  },
  machine: {
    timestamp: number,
    publicKey: string,
    signature: string,
  },
  rosterConfig: RosterLockV1Config,
  // Keyed by local player index on this machine (0-based) - a machine with
  // multiple local players (e.g. 2 controllers) submits one entry per player.
  playerSelections: Record<number, UserSelection>,
};
