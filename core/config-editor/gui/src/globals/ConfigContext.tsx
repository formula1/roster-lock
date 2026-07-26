import {
  createContext, useContext, useEffect, useState,
  type Dispatch, type PropsWithChildren, type SetStateAction,
} from "react";
import { RosterLockV1Draft, RosterLockV1Config } from "@roster-lock/types";
import { cloneJSON, JSON_Unknown } from "@roster-lock/utils";
import { ROSTERLOCK_V1_DRAFT_CASTER_JSONSCHEMA } from "@roster-lock/shared";
import { diff } from "json-diff-ts";

// What a host (Tauri app, PWA, ...) supplies: where the draft comes from and
// how to act on it. No notion of a filename/filepath here - a host that has
// one (e.g. Tauri, keyed off a file on disk) keeps that entirely to itself.
// save/saveAs/publish take the value to persist explicitly, so the host
// never needs to track "the current draft" itself.
export type ConfigSource = (
  | { state: "empty" }
  | {
    state: "error",
    error: unknown,
    reload: () => void,
  }
  | {
    state: "ready",
    contents: JSON_Unknown,
    reload: () => void,
    save: (newDraft: RosterLockV1Draft) => Promise<void>,
    // Host decides how to prompt for + persist to a new destination (native
    // save dialog, browser download, a match-agent call, ...).
    saveAs: (newDraft: RosterLockV1Draft) => Promise<void>,
    publish: (lock: RosterLockV1Config) => Promise<void>,
  }
);

// What pages consume via useConfig(). Adds edit-tracking (isDirty/update/
// reset) on top of the host's source - handled internally here so hosts
// don't each have to reimplement dirty-checking.
export type ConfigContextValue = (
  | { state: "empty" }
  | {
    state: "error",
    error: unknown,
    reload: () => void,
  }
  | {
    state: "ready",
    draft: RosterLockV1Draft,
    isDirty: boolean,
    update: (draft: SetStateAction<RosterLockV1Draft>) => void,
    reset: () => void,
    save: (newDraft: RosterLockV1Draft) => Promise<void>,
    saveAs: (newDraft: RosterLockV1Draft) => Promise<void>,
    publish: (lock: RosterLockV1Config) => Promise<void>,
  }
);

const ConfigContext = createContext<ConfigContextValue>({ state: "empty" });

export function useConfig(){
  return useContext(ConfigContext);
}

// Lets the host (Tauri app, PWA, ...) plug in / swap out the ConfigSource -
// e.g. once a file finishes loading, or when the user opens a different one.
// Pages never touch this directly; they only ever go through useConfig().
const ConfigSourceContext = createContext<[ConfigSource, Dispatch<SetStateAction<ConfigSource>>]>(
  [{ state: "empty" }, () => {}]
);

export function useConfigSource(){
  return useContext(ConfigSourceContext);
}

export function ConfigSourceProvider(props: PropsWithChildren){
  const state = useState<ConfigSource>({ state: "empty" });
  return (
    <ConfigSourceContext.Provider value={state}>
      {props.children}
    </ConfigSourceContext.Provider>
  );
}

export function ConfigContextProvider(props: PropsWithChildren){
  const [source] = useConfigSource();

  const [edit, setEdit] = useState<(
    | null
    | {
      state: "error",
      error: unknown,
      reload: ()=> void,
    }
    | {
      state: "ready"
      value: { original: RosterLockV1Draft, active: RosterLockV1Draft }
    }
  )>(null);

  useEffect(()=>{
    if(source.state === "empty"){
      setEdit(null);
      return;
    }
    if(source.state === "error"){
      setEdit(source);
      return;
    }
    const castResult = ROSTERLOCK_V1_DRAFT_CASTER_JSONSCHEMA.safeCast(
      source.contents, false
    )
    if(!castResult.valid){
      setEdit({
        state: "error",
        error: castResult.error,
        reload: source.reload,
      })
      return;
    }
    setEdit({
      state: "ready",
      value: {
        original: cloneJSON(castResult.value),
        active: cloneJSON(castResult.value)
      }
    });
  }, [source]);

  const value: ConfigContextValue = (()=>{
    if(!edit) return { state: "empty" }
    if(source.state === "empty") return { state: "empty" }

    if(edit.state == "error") return edit;
    if(source.state === "error") return source

    return {
      state: "ready",
      draft: edit.value.active,
      isDirty: diff(edit.value.original, edit.value.active).length > 0,
      update: (next) => setEdit((prev)=>{
        if(prev?.state !== "ready") return prev;
        const active = (
          typeof next !== "function" ? next :
          (next as (d: RosterLockV1Draft) => RosterLockV1Draft)(prev.value.active)
        );
        return {
          state: "ready",
          value: { ...prev.value, active }
        }
      }),
      reset: () => setEdit((prev)=>{
        if(prev?.state !== "ready") return prev;
        return {
          state: "ready",
          value: { ...prev.value, active: cloneJSON(prev.value.original) }
        }
      }),
      save: async (newDraft) => {
        await source.save(newDraft);
        setEdit({
          state: "ready",
          value: { original: cloneJSON(newDraft), active: cloneJSON(newDraft) }
        });
      },
      saveAs: async (newDraft) => {
        await source.saveAs(newDraft);
        setEdit({
          state: "ready",
          value: { original: cloneJSON(newDraft), active: cloneJSON(newDraft) }
        });
      },
      publish: source.publish,
    };
  })();

  return (
    <ConfigContext.Provider value={value}>
      {props.children}
    </ConfigContext.Provider>
  );
}
