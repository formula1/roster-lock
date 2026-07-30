import { useEffect, useRef, useState, useCallback } from "react";

export type ProcessResult<T> = (
  | { status: "pending", previous: T | null, refresh: ()=>void }
  | { status: "failed", error: unknown, previous: T | null, refresh: ()=>void }
  | { status: "success", value: T, refresh: ()=>void }
);

export function usePromisedMemo<Deps extends readonly unknown[], T>(
  getValue: ()=>Promise<T>, deps: Deps
){
  const activeProcess = useRef(-1);
  const [shouldRun, setShouldRun] = useState(Date.now());
  const refresh = useCallback(()=>(setShouldRun(Date.now())), []);
  const [result, setResult] = useState<ProcessResult<T>>({
    status: "pending", previous: null, refresh
  });
  useEffect(()=>{
    const active = Date.now();
    activeProcess.current = active;
    setResult({
      status: "pending",
      previous: extractValue(result),
      refresh
    });
    Promise.resolve().then(async function(){
      try {
        const value = await getValue();
        if(activeProcess.current !== active) return;
        setResult({ status: "success", value, refresh });
      }catch(e){
        if(activeProcess.current !== active) return;
        setResult({
          status: "failed",
          error: e,
          previous: extractValue(result),
          refresh
        });
      }
    });
  }, [shouldRun, ...deps]);

  return result;
}

function extractValue<T>(value: ProcessResult<T>){
  if(value.status === "success") return value.value;
  return value.previous;
}

export function promisedValueOrUndefined<T>(value: ProcessResult<T>){
  if(value.status === "success") return value.value;
}