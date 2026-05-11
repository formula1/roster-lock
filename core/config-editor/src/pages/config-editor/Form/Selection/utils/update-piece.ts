import { RosterLockV1Config } from "@roster-lock/types";

export function updatePiece(
  oldRosterLock: RosterLockV1Config,
  pieceType: string,
  pieceConfig: RosterLockV1Config["selection"]["piece"][string]
): RosterLockV1Config {
  return {
    ...oldRosterLock,
    selection: {
      ...oldRosterLock.selection,
      piece: {
        ...oldRosterLock.selection.piece,
        [pieceType]: pieceConfig,
      },
    },
  };
}
