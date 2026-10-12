import { ChildProcess } from "node:child_process";
import { GameProcessHandle } from "@roster-lock/types";

export function toProcessHandle(child: ChildProcess): GameProcessHandle {
  const exitCallbacks: Array<(code: number | null) => void> = [];
  const crashCallbacks: Array<(error: Error) => void> = [];

  const handle: GameProcessHandle = {
    exited: false,
    onExit(cb){ exitCallbacks.push(cb); },
    onCrash(cb){ crashCallbacks.push(cb); },
    async stop(){
      if(typeof child.pid !== "number") return;
      try {
        // detached:true puts the child in its own process group - killing the
        // negative pid kills the group, not just the immediate process, which
        // matters since Ikemen may itself spawn helper processes.
        process.kill(-child.pid);
      } catch(e){
        // Already exited - nothing to do.
      }
    },
  };

  child.on("exit", (code) => {
    // GameProcessHandle.exited needs a concrete number; the "exit" event's
    // code is null when the process was killed by a signal rather than
    // exiting normally - -1 is a placeholder for that case, distinguishable
    // from a real exit code (which Node always reports as >= 0).
    handle.exited = { code: code ?? -1 };
    for(const cb of exitCallbacks) cb(code);
  });
  child.on("error", (error) => {
    for(const cb of crashCallbacks) cb(error);
  });

  return handle;
}
