import {
  createContext, useContext, Context, type PropsWithChildren,
  useEffect, useState, useCallback,
  SetStateAction
} from "react";
import { fs } from "../../tauri/fs";
import { usePromisedMemo } from "../../utils/react/promised-memo";
import { cloneJSON, JSON_Unknown } from "@roster-lock/utils";

import { diff } from 'json-diff-ts';

type CurrentFileContextType<T> = (
  | {
    activeFile: null
  }
  | {
    activeFile: string;
    state: "loading",
  }
  | {
    activeFile: string;
    state: "failed",
    reload: ()=>void
    error: any,
    value?: JSON_Unknown
  }
  | {
    activeFile: string;
    state: "ready",
    reload: ()=>void
    isDirty: boolean,
    value: T;
    update: (config: SetStateAction<T>) => void;
    reset: () => void;
    save: () => Promise<void>;
    saveAs: (newPath: string) => Promise<void>;
  }
);

export function createCurrentFileContext<T extends JSON_Unknown>(
  defaultValue: T, caster: (json: unknown) => T
){
  const context = createContext<CurrentFileContextType<T>>({ activeFile: null });

  return {
    useCurrentFile: function(){
      return useContext(context);
    },
    CurrentFileProvider: (props: PropsWithChildren<{ filePath?: string }>)=>(
      <CurrentFileProvider
        filePath={props.filePath}
        defaultValue={defaultValue}
        caster={caster}
        context={context}
      >
        {props.children}
      </CurrentFileProvider>
    ),
  };
}

export function CurrentFileProvider<T extends JSON_Unknown>(
  { filePath: activeFile, defaultValue, caster,  context, children }: PropsWithChildren<{
    filePath?: string, defaultValue: T, caster: (json: unknown) => T,
    context: Context<CurrentFileContextType<T>>,
  }>
) {

  const memoResult = usePromisedMemo(async ()=>{
    if(!activeFile) throw new Error("No active file");
    return await fs.readJSON(activeFile);
  }, [activeFile])

  const [originalValue, setOriginalValue] = useState<T>(cloneJSON(defaultValue));
  const [activeValue, setActiveValue] = useState<T>(cloneJSON(defaultValue));
  const [castError, setCastError] = useState<{ failed: boolean, e: any }>({ failed: false, e: null });

  useEffect(()=>{
    try {
      if(memoResult.status !== "success") return;
      caster(memoResult.value)
      setCastError({ failed: false, e: null })
      setOriginalValue(cloneJSON(memoResult.value));
      setActiveValue(cloneJSON(memoResult.value));
    }catch(e){
      setCastError({ failed: true, e })
    }
  }, [memoResult])

  const props: CurrentFileContextType<T> = (() => {
    if(!activeValue || !activeFile) return { activeFile: null };
    if(memoResult.status === "pending") return { activeFile, state: "loading" };
    if(memoResult.status === "failed") return {
      activeFile,
      state: "failed",
      reload: memoResult.refresh,
      error: memoResult.error
    };
    if(castError.failed) return {
      activeFile,
      state: "failed",
      reload: memoResult.refresh,
      error: castError.e,
      value: memoResult.value
    }
    return {
      activeFile,
      state: "ready",
      reload: memoResult.refresh,
      value: activeValue,
      update: setActiveValue,
      isDirty: diff(originalValue, activeValue).length > 0,
      reset: () => setActiveValue(cloneJSON(originalValue)),
      save: async () => {
        if(!activeFile) return;
        await fs.writeJSON(activeFile, activeValue);
        setOriginalValue(cloneJSON(activeValue));
      },
      saveAs: async (newPath: string) => {
        await fs.writeJSON(newPath, activeValue);
        setOriginalValue(cloneJSON(activeValue));
      }
    };
  })();
  return (
    <context.Provider value={props} >
      { children }
    </context.Provider>
  );
}
