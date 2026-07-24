import { RosterLockV1Config } from "@roster-lock/types";

export function updatePieceMeta(
  oldRosterLock: RosterLockV1Config,
  pieceType: string,
  pieceMeta: RosterLockV1Config["pieceMeta"][string]
): RosterLockV1Config {
  return {
    ...oldRosterLock,
    pieceMeta: {
      ...oldRosterLock.pieceMeta,
      [pieceType]: pieceMeta,
    },
  };
}
