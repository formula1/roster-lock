import { JSON_Unknown } from "@match-lock/shared";

export enum ROOM_EVENT {
  roomFull = "room-full",
  userLeft = "user-left",
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

export class ExternalUserError extends Error {
  constructor(public userId: string, public rawError: JSON_Unknown){
    super("External User Error");
  }
}

export class UserMessegeError extends Error {
  constructor(public userId: string, public message: string){
    super(message);
  }
}