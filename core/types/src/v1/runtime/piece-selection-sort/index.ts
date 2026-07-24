
import { RosterLockV1Config } from "../../lock";
import { PieceType, UserId, LogicId } from "../../shared";
import { UserSelection } from "../../request";

export type SortPiecesArg = {
  lockConfig: RosterLockV1Config,
  pieceType: PieceType,
  dataDir: string,
};

export type HandleFullSelectionArg = {
  lockConfig: RosterLockV1Config,
  // In case we only want to save local selections
  localUsers: Array<UserId>,
  // User Selections have all users
  userSelections: Record<UserId, UserSelection>,
  dataDir: string,
};

export type HandleGameCompleteArg = HandleFullSelectionArg & {
  winners: Array<UserId>,
};

export type PieceSelectionSortPlugin = {
  name: string,
  publicInfo: {
    title: string,
    description: string,
  },
  sortPieces: (arg: SortPiecesArg) => Promise<Array<LogicId>>,
  handleFullSelection: (arg: HandleFullSelectionArg) => Promise<void>,
  handleGameComplete: (arg: HandleGameCompleteArg) => Promise<void>,
};
