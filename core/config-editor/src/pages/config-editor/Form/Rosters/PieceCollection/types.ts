import { RosterLockV1Draft } from "@roster-lock/types";

type RosterLockV1Config = RosterLockV1Draft["stagedLock"];

export type PieceDefinition = RosterLockV1Config["engine"]["pieceDefinitions"][string];
export type PieceValue = RosterLockV1Config["rosters"][string][number];

export type PieceDraftInfo = RosterLockV1Draft["draft"]["rosterPieceInfo"][string][string]