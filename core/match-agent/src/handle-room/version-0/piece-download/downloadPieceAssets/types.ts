import { MatchLockPublishPiece, MatchLockAsset } from "@match-lock/shared";

export type AssetDownloadProgress = {
  pieceId: string;
  filePath: string;
  bytesDownloaded: number;
  totalBytes: number;
  progress: number; // 0-1
};

export type AssetDownloadResult = {
  filePath: string;
  localPath: string;
  asset: MatchLockAsset;
};

export type PieceDownloadProgress = {
  pieceId: string;
  completedAssets: number;
  totalAssets: number;
  currentAsset?: AssetDownloadProgress;
};

export type ProgressListener = (progress: PieceDownloadProgress) => void;

export type AssetDownloadOptions = {
  piece: MatchLockPublishPiece;
  filePath: string;
  asset: MatchLockAsset;
  targetDirectory: string;
  onProgress?: (progress: AssetDownloadProgress) => void;
};
