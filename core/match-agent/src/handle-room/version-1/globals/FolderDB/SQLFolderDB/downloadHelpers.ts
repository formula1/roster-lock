
import { mkdir, rm as fsRm } from "node:fs/promises";
import { PluginManager } from "@roster-lock/plugin-runtime";
import { ProgressHandlers } from "../../../handleDownloads/types";
import { MultiAbortSignal, raceWithAbort } from "./MultiAbort";

// Dedupes concurrent requests for the same download key (piece or media
// override - the key namespace is the caller's choice) so two requesters
// racing for the same content share one in-flight download instead of
// starting two. Pure in-flight coordination - persistence/state-machine
// bookkeeping (pending/complete rows) stays the caller's responsibility.
export class DownloadCoordinator<TResult> {
  private activeDownloads = new Map<string, {
    multiSignal: MultiAbortSignal,
    result: Promise<TResult>
  }>();

  async run(
    key: string,
    progressHandlers: ProgressHandlers,
    start: (abortSignal: AbortSignal) => Promise<TResult>,
  ): Promise<TResult> {
    const activePromise = this.activeDownloads.get(key);
    if(activePromise){
      activePromise.multiSignal.addSignal(progressHandlers);
      try {
        return await raceWithAbort(activePromise.result, progressHandlers.abortSignal);
      }catch(e){
        activePromise.multiSignal.removeSignal(progressHandlers);
        throw e;
      }
    }

    const multiSignal = new MultiAbortSignal([progressHandlers]);
    const promise = start(multiSignal.abortSignal);
    this.activeDownloads.set(key, { multiSignal, result: promise });
    // promise is already awaited below via raceWithAbort; catch here too so
    // this second attached continuation doesn't count as an unhandled
    // rejection (each .then/.finally chain is tracked independently by Node).
    promise.finally(()=>{
      multiSignal.clear();
      this.activeDownloads.delete(key);
    }).catch(()=>{});
    try {
      return await raceWithAbort(promise, progressHandlers.abortSignal);
    }catch(e){
      multiSignal.removeSignal(progressHandlers);
      throw e;
    }
  }

  emitProgress(key: string, event: Parameters<ProgressHandlers["onProgress"]>[0]){
    const multiSignal = this.activeDownloads.get(key)?.multiSignal;
    if(!multiSignal) return;
    multiSignal.emitEvent(event);
  }
}

// Tries each download source in order (first success wins), verifying the
// downloaded content against an expected version after each attempt and
// wiping the destination folder between failures. What "verify" computes and
// what counts as a match is caller-defined so this loop is shared between
// piece and media-override downloads despite their different version shapes.
export async function downloadWithFallbackSources<TVersion>(
  {
    downloadSources, destinationFolder, abortSignal, pluginRuntime,
    onProgress, onValidating, verify, versionsMatch, onSourceSuccess, onSourceFailure,
  }: {
    downloadSources: Array<string>,
    destinationFolder: string,
    abortSignal: AbortSignal,
    pluginRuntime: PluginManager,
    onProgress: (progress: number) => void,
    onValidating: () => void,
    verify: (folder: string) => Promise<TVersion>,
    versionsMatch: (actual: TVersion) => boolean,
    onSourceSuccess: (source: string) => void,
    onSourceFailure: (source: string, message: string) => void,
  }
): Promise<void> {
  for(const downloadLocation of downloadSources){
    try {
      await mkdir(destinationFolder, { recursive: true });
      const { finishPromise } = await pluginRuntime.downloadToFolder({
        url: downloadLocation,
        destinationFolder,
        processHandlers: { onProgress, abortSignal },
      });
      await finishPromise;
      onValidating();
      const actual = await verify(destinationFolder);
      if(!versionsMatch(actual)) throw new Error("Version Mismatch");
      onSourceSuccess(downloadLocation);
      return;
    }catch(e){
      onSourceFailure(downloadLocation, (e as Error).message);
      await fsRm(destinationFolder, { recursive: true, force: true });
    }
  }
  throw new Error("Failed To Download");
}
