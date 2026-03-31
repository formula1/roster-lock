import { RosterLockV1Config } from "@roster-lock/types";

export type PieceDefinition = RosterLockV1Config["engine"]["pieceDefinitions"][string];

export type EngineAssetDefinition = PieceDefinition["assets"][number];
