
export enum ROOM_EVENT {
  startRoom = "room-start",
  userEntered = "user-entered",
  userLeft = "user-left",
  initGoodbye = "init-goodbye",
}

export enum USER_EVENT {
  hello = "user-hello",
  finish = "user-finish",
  goodbye = "user-goodbye",
}

export enum MATCHLOCK_SELECTION_STATE {
  failure = "failure",

  hello = "selection-hello",
  lockConfig = "selection-lock",
  selectionEncrypt = "selection-encrypt",
  selectionDecrypt = "selection-decrypt",
  selectionFinal = "selection-final",
  goodbye = "selection-goodbye",
}

export enum MATCHLOCK_DOWNLOAD_STATE {
  failure = "failure",

  hello = "download-hello",
  downloadStart = "download-start",
  downloadProgress = "download-progress",
  downloadValidation = "download-validation",
  downloadFinished = "download-finished",
  downloadFailure = "download-failure",

  downloadAllComplete = "download-all-complete",
  downloadFullFailure = "download-full-fail",
  goodbye = "download-goodbye",
}

