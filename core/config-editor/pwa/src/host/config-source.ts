import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  useConfigSource, type ConfigSource,
} from "@roster-lock/config-editor-gui";
import type { JSON_Unknown } from "@roster-lock/utils";
import { getDraft, putDraft, newDraftId, type DraftRecord } from "./drafts";
import { downloadFile } from "./files";
import { RosterLockPaths } from "../globals/RosterLockPaths";

// Open an IndexedDB draft into the gui's ConfigSource and jump to the
// editor. Which record backs the source lives in these closures - the gui
// never learns about draft ids.
export function useOpenDraft(){
  const [, setSource] = useConfigSource();
  const navigate = useNavigate();

  return useCallback(async (draftId: string) => {
    await loadDraftIntoSource(draftId, setSource);
    navigate(RosterLockPaths.Root);
  }, [setSource, navigate]);
}

type SetSource = (source: ConfigSource) => void;

async function loadDraftIntoSource(draftId: string, setSource: SetSource){
  try {
    const record = await getDraft(draftId);
    if(!record) throw new Error("Draft not found: " + draftId);
    setSource(draftSource(record, setSource));
  }catch(error){
    setSource({
      state: "error",
      error,
      reload: () => { loadDraftIntoSource(draftId, setSource); },
    });
  }
}

function draftSource(record: DraftRecord, setSource: SetSource): ConfigSource {
  return {
    state: "ready",
    contents: record.contents,
    reload: () => { loadDraftIntoSource(record.id, setSource); },
    save: async (newDraft) => {
      await putDraft({ ...record, contents: newDraft as JSON_Unknown, updatedAt: Date.now() });
    },
    saveAs: async (newDraft) => {
      const name = prompt("Save draft as", record.name + " copy");
      if(!name) return;
      const copy: DraftRecord = {
        id: newDraftId(),
        name,
        updatedAt: Date.now(),
        contents: newDraft as JSON_Unknown,
      };
      await putDraft(copy);
      // Re-point the source so later saves go to the copy.
      setSource(draftSource(copy, setSource));
    },
    publish: async (lock) => {
      downloadFile(
        `${lock.title}-${lock.version}.rosterlock.json`,
        JSON.stringify(lock, null, 2),
        "application/json"
      );
    },
  };
}
