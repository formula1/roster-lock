
export enum ROSTERLOCK_DOWNLOAD_STATE {
  downloadStart = "download-start",
  downloadProgress = "download-progress",
  downloadValidation = "download-validation",
  downloadFinished = "download-finished",
  downloadFailure = "download-failure",

  mediaOverrideDownloadStart = "media-override-download-start",
  mediaOverrideDownloadProgress = "media-override-download-progress",
  mediaOverrideDownloadValidation = "media-override-download-validation",
  mediaOverrideDownloadFinished = "media-override-download-finished",
  mediaOverrideDownloadFailure = "media-override-download-failure",

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
    type: ROSTERLOCK_DOWNLOAD_STATE.mediaOverrideDownloadStart,
    pieceType: string,
    logic: string,
    override: string,
  }
  | {
    type: ROSTERLOCK_DOWNLOAD_STATE.mediaOverrideDownloadProgress,
    pieceType: string,
    logic: string,
    override: string,
    progress: number,
  }
  | {
    type: ROSTERLOCK_DOWNLOAD_STATE.mediaOverrideDownloadValidation,
    pieceType: string,
    logic: string,
    override: string,
  }
  | {
    type: ROSTERLOCK_DOWNLOAD_STATE.mediaOverrideDownloadFinished,
    pieceType: string,
    logic: string,
    override: string,
  }
  | {
    type: ROSTERLOCK_DOWNLOAD_STATE.mediaOverrideDownloadFailure,
    pieceType: string,
    logic: string,
    override: string,
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

