
import { RosterLockV1Config } from "../../lock";
import { PieceType, PlayerId, LogicId } from "../../shared";
import { UserSelection } from "../../request";

export type SortPiecesArg = {
  lockConfig: RosterLockV1Config,
  pieceType: PieceType,
  dataDir: string,
};

export type HandleFullSelectionArg = {
  lockConfig: RosterLockV1Config,
  // In case we only want to save local selections
  localUsers: Array<PlayerId>,
  // User Selections have all users
  userSelections: Record<PlayerId, UserSelection>,
  dataDir: string,
};

export type HandleGameCompleteArg = HandleFullSelectionArg & {
  winners: Array<PlayerId>,
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
