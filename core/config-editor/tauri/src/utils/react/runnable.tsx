import { useEffect, useRef, useState, useCallback } from "react";

export enum RunnableState {
  INACTIVE = "inactive",
  PENDING = "pending",
  FAILED = "failed",
  SUCCESS = "success",
};

type ProcessResult<T> = (
  | { state: RunnableState.INACTIVE }
  | { state: RunnableState.PENDING }
  | { state: RunnableState.FAILED, error: unknown }
  | { state: RunnableState.SUCCESS, value: T }
);

export function useRunnable<T>(
  runnableFunction: ()=>Promise<T>
){
  const activeProcess = useRef(-1);
  const [result, setResult] = useState<ProcessResult<T>>({
    state: RunnableState.INACTIVE,
  });
  const run = useCallback(()=>{
    const active = Date.now();
    activeProcess.current = active;
    setResult({ state: RunnableState.PENDING });
    Promise.resolve().then(async function(){
      try {
        const value = await runnableFunction();
        if(activeProcess.current !== active) return;
        setResult({ state: RunnableState.SUCCESS, value, });
      }catch(e){
        if(activeProcess.current !== active) return;
        setResult({
          state: RunnableState.FAILED,
          error: e,
        });
      }
    });
  }, [runnableFunction]);

  useEffect(()=>{
    setResult({ state: RunnableState.INACTIVE })
  }, [run]);

  (result as ProcessResult<T> & { run: ()=>void }).run = run;
  return result as ProcessResult<T> & { run: ()=>void };
}

