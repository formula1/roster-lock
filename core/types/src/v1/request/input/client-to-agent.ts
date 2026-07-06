import { RosterLockV1Config } from "../../lock";

import { UserSelection } from "../shared";

export type RosterLockV1SyncDLRequestClientToAgent = {
  folder: string,
  relay: {
    url: string,
    roomId: string,
  },
  user: {
    timestamp: number,
    publicKey: string,
    signature: string,
  },
  rosterConfig: RosterLockV1Config,
  userSelection: UserSelection,
};
