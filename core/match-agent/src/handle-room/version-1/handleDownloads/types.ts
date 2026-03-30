
import { DownloadUpdate } from "./events";

export type ProgressHandlers = {
  onProgress: (update: DownloadUpdate) => void;
  abortSignal: AbortSignal;
}

export { DownloadResult, DownloadResultsMap } from "@match-lock/shared";
