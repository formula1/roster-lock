
import { fork } from "child_process";

import { castMessage } from "./script-message";
import { ScriptStarter } from "@match-lock/shared";

type StdioHandlers = (
  out: NodeJS.ReadableStream | null,
  err: NodeJS.ReadableStream | null,
)=>any
const DEFAULT_OPTIONS = {
  timeout: 1000 * 60 * 5, // 5 minutes
  env: {},
}

export async function forkRunUntrusted(
  forkPath: string,
  args: Array<string>,
  toRun: ScriptStarter,
  options: Partial<{
    timeout: number,
    env: Record<string, string>,
    abortSignal: AbortSignal,
    stdioHandlers: StdioHandlers
  }> = {}
){
  return new Promise((res, rej)=>{
    const { timeout, env, abortSignal, stdioHandlers } = { ...DEFAULT_OPTIONS, ...options };
    let resolved = false;

    const abortHandler = ()=>{
      if(cleanup()) rej(new Error("Aborted"));
    }
    abortSignal?.addEventListener("abort", abortHandler)

    const timer = setTimeout(() => {
      if (cleanup()) {
        rej(new Error(`Script timeout after ${timeout}ms`));
      }
    }, timeout);

    const child = fork(forkPath, args, {
      env,
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'] // Capture stdout/stderr
    });

    child.on("message", (uncasted)=>{
      try {
        const message = castMessage(uncasted);
        if(message.type === "ready"){
          return child.send(toRun);
        } else if(message.type === "error"){
          throw new Error(message.data.message);
        } else if(message.type === "result"){
          cleanup();
          res(message.data);
        } else {
          throw new Error("Unknown Message Type");
        }
      }catch(e){
        cleanup();
        rej(e);
      }
    });
    child.on("error", (e)=>{
      cleanup();
      rej(e);
    });
    child.on("exit", (code, signal) => {
      if(cleanup()){
        if (signal) {
          rej(new Error(`Script killed by signal: ${signal}`));
        } else if (code !== 0) {
          rej(new Error(`Script exited with code: ${code}`));
        } else {
          rej(new Error('Script exited without result'));
        }
      }
    });
    if(stdioHandlers){
      stdioHandlers(child.stdout, child.stderr);
    }

    function cleanup(): boolean{
      if (resolved) return false;
      resolved = true;
      abortSignal?.removeEventListener("abort", abortHandler);
      clearTimeout(timer);
      child.removeAllListeners();
      child.kill();
      return true;
    };
  })
}
