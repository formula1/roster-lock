
export enum ROSTERLOCK_DOWNLOAD_STATE {
  downloadStart = "download-start",
  downloadProgress = "download-progress",
  downloadValidation = "download-validation",
  downloadFinished = "download-finished",
  downloadFailure = "download-failure",

  downloadAllComplete = "download-all-complete",
  downloadFullFailure = "download-full-fail",
}

export type RosterLockDownloadUpdate = (
  | {
    type: ROSTERLOCK_DOWNLOAD_STATE.downloadStart,
    pieceType: string,
    pieceVersions: { logic: string, media: string },
  }
  | {
    type: ROSTERLOCK_DOWNLOAD_STATE.downloadProgress,
    pieceType: string,
    pieceVersions: { logic: string, media: string },
    progress: number,
  }
  | {
    type: ROSTERLOCK_DOWNLOAD_STATE.downloadValidation,
    pieceType: string,
    pieceVersions: { logic: string, media: string },
  }
  | {
    type: ROSTERLOCK_DOWNLOAD_STATE.downloadFinished,
    pieceType: string,
    pieceVersions: { logic: string, media: string },
  }
  | {
    type: ROSTERLOCK_DOWNLOAD_STATE.downloadFailure,
    pieceType: string,
    pieceVersions: { logic: string, media: string },
    error: string,
  }
  | {
    type: ROSTERLOCK_DOWNLOAD_STATE.downloadAllComplete,
  }
  | {
    type: ROSTERLOCK_DOWNLOAD_STATE.downloadFullFailure,
    error: string,
  }
)

