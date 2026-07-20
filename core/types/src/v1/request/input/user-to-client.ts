import { RosterLockV1Config } from "../../lock";

import { UserSelection } from "../shared";

export type RosterLockV1SyncDLRequestUserToClient = {
  version: 1,
  relay: {
    url: string,
    roomId: string,
  },
  user: {
    userId: string;
    keys: {
      publicKey: string,
      privateKey: string,
    }
  },
  rosterConfig: RosterLockV1Config,
  userSelection: UserSelection,
};