import { JSON_Unknown } from "@match-lock/shared";

export enum MATCHLOCK_SELECTION_STATE {
  failure = "failure",

  hello = "hello",
  restriction = "restriction",
  selectionEncrypt = "selection-encrypt",
  selectionDecrypt = "selection-decrypt",
  selectionFinal = "selection-final",
  goodbye = "goodbye",
}

export enum MATCHLOCK_DOWNLOAD_STATE {
  failure = "failure",

  hello = "hello",
  selectionFinal = "selection-final",
  downloadStart = "download-start",
  downloadProgress = "download-progress",
  downloadValidation = "download-validation",
  downloadFinished = "download-finished",

  downloadFailure = "download-failure",
  downloadAllComplete = "download-all-complete",
  goodbye = "goodbye",
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