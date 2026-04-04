
import { RosterLockDownloadUpdate } from "@roster-lock/types";

export type ProgressHandlers = {
  onProgress: (update: RosterLockDownloadUpdate) => void;
  abortSignal: AbortSignal;
}

export { DownloadResult, DownloadResultsMap } from "@roster-lock/types";
