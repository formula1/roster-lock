import type {
  RosterLockV1Config,
} from '@roster-lock/types';

export type EnginePieceDefinition = RosterLockV1Config['engine']['pieceDefinitions'][string];
export type EngineAssetDefinition = EnginePieceDefinition['assets'][number];

export type FileTestResult = {
  filePath: string;
  relativePath: string;
  fileSize: number;
  matchedAssets: Array<EngineAssetDefinition>;
};

