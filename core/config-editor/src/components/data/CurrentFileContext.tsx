import {
  createContext, useContext, Context, type PropsWithChildren,
  useEffect, useState, useCallback,
  SetStateAction
} from "react";
import { useParams } from "react-router";
import { fs } from "../../tauri/fs";
import { usePromisedMemo } from "../../utils/react/promised-memo";
import { cloneJSON, JSON_Unknown } from "@roster-lock/shared";

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
    error: any,
  }
  | {
    activeFile: string;
    state: "ready",
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
  const params = useParams();

  const loadFile = useCallback(async (filePath: string) => {
    const json = await fs.readJSON(filePath);
    const value = caster(json);
    return value;
  }, [])

  const memoResult = usePromisedMemo(async ()=>{
    if(!activeFile) throw new Error("No active file");
    return await loadFile(activeFile);
  }, [activeFile])

  const [originalValue, setOriginalValue] = useState<T>(cloneJSON(defaultValue));

  const [activeValue, setActiveValue] = useState<T>(cloneJSON(defaultValue));

  useEffect(()=>{
    if(memoResult.status === "success"){
      setOriginalValue(cloneJSON(memoResult.value));
      setActiveValue(cloneJSON(memoResult.value));
    }
  }, [memoResult])

  const props: CurrentFileContextType<T> = (() => {
    if(!activeValue || !activeFile) return { activeFile: null };
    if(memoResult.status === "pending") return { activeFile, state: "loading" };
    if(memoResult.status === "failed") return { activeFile, state: "failed", error: memoResult.error };
    return {
      activeFile,
      state: "ready",
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
