
import { DownloadUpdate } from "./events";

export type ProgressHandlers = {
  onProgress: (update: DownloadUpdate) => void;
  abortSignal: AbortSignal;
}
