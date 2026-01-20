
import { DownloadUpdate } from "./events";

export type ProgressHandlers = {
  onProgress: (update: DownloadUpdate) => void;
  abortSignal: AbortSignal;
}

import { PieceType, PieceId } from "@match-lock/shared";

export type DownloadResult = {
  pieceType: PieceType,
  pieceId: PieceId,
  pieceVersions: { logic: string, media: string },
  folder: string,
}

export type ResultsMap = Record<PieceType, Record<PieceId, DownloadResult>>;
