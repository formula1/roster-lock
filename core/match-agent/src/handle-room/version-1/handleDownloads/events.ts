
import { MATCHLOCK_DOWNLOAD_STATE } from "../constants";

export type DownloadUpdate = (
  | {
    type: MATCHLOCK_DOWNLOAD_STATE.downloadStart,
    pieceType: string,
    pieceVersions: { logic: string, media: string },
  }
  | {
    type: MATCHLOCK_DOWNLOAD_STATE.downloadProgress,
    pieceType: string,
    pieceVersions: { logic: string, media: string },
    progress: number,
  }
  | {
    type: MATCHLOCK_DOWNLOAD_STATE.downloadValidation,
    pieceType: string,
    pieceVersions: { logic: string, media: string },
  }
  | {
    type: MATCHLOCK_DOWNLOAD_STATE.downloadFinished,
    pieceType: string,
    pieceVersions: { logic: string, media: string },
  }
  | {
    type: MATCHLOCK_DOWNLOAD_STATE.downloadFailure,
    pieceType: string,
    pieceVersions: { logic: string, media: string },
    error: string,
  }
  | {
    type: MATCHLOCK_DOWNLOAD_STATE.downloadAllComplete,
  }
  | {
    type: MATCHLOCK_DOWNLOAD_STATE.downloadFullFailure,
    error: string,
  }
)

