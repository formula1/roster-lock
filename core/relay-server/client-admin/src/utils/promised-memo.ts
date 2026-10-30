import { useEffect, useRef, useState, useCallback } from "react";

type ProcessResult<T> = (
  | { status: "not-run", update: ()=>void }
  | { status: "pending", previous: T | null, update: ()=>void }
  | { status: "failed", error: unknown, previous: T | null, update: ()=>void }
  | { status: "success", value: T, update: ()=>void }
);

export function usePromisedMemo<Deps extends readonly unknown[], T>(
  getValue: null | (()=>Promise<T>), deps: Deps
){
  const activeProcess = useRef(-1);
  const [shouldRun, setShouldRun] = useState(Date.now());
  const update = useCallback(()=>(setShouldRun(Date.now())), []);
  const [result, setResult] = useState<ProcessResult<T>>({
    status: "pending", previous: null, update
  });
  useEffect(()=>{
    const active = Date.now();
    activeProcess.current = active;
    if(!getValue){
      setResult({ status: "not-run", update });
      return;
    }
    setResult({
      status: "pending",
      previous: extractValue(result),
      update
    });
    Promise.resolve().then(async function(){
      try {
        const value = await getValue();
        if(activeProcess.current !== active) return;
        setResult({ status: "success", value, update });
      }catch(e){
        if(activeProcess.current !== active) return;
        setResult({
          status: "failed",
          error: e,
          previous: extractValue(result),
          update
        });
      }
    });
  }, [shouldRun, ...deps]);

  return result;
}

function extractValue<T>(value: ProcessResult<T>){
  if(value.status === "success") return value.value;
  if(value.status === "not-run") return null;
  return value.previous;
}
