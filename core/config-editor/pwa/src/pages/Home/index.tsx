import { useCallback, useEffect, useState } from "react";
import { cloneJSON, type JSON_Unknown } from "@roster-lock/utils";
import {
  EMPTY_ROSTER_DRAFT,
  ROSTERLOCK_V1_CASTER_JSONSCHEMA,
  ROSTERLOCK_V1_DRAFT_CASTER_JSONSCHEMA,
} from "@roster-lock/shared";

import { AgentSettingsSection } from "@roster-lock/config-editor-gui";

import {
  listDrafts, getDraft, putDraft, deleteDraft, newDraftId, type DraftSummary,
} from "../../host/drafts";
import { useOpenDraft } from "../../host/config-source";
import { pickSingleFile, downloadFile } from "../../host/files";

export function HomePage(){
  return (
    <div style={{ padding: "20px", display: "grid", gap: "20px" }}>
      <h1>Roster Lock Config</h1>
      <DraftActions />
      <DraftList />
      <AgentSettingsSection />
    </div>
  );
}

function errorToString(e: unknown){
  return e instanceof Error ? e.message : String(e);
}

function DraftActions(){
  const openDraft = useOpenDraft();
  const [err, setErr] = useState<null | string>(null);

  const createAndOpen = useCallback(async (name: string, contents: JSON_Unknown) => {
    const record = { id: newDraftId(), name, updatedAt: Date.now(), contents };
    await putDraft(record);
    await openDraft(record.id);
  }, [openDraft]);

  return <div className="section">
    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
      <button
        onClick={async ()=>{
          try {
            const name = prompt("Name the new draft");
            if(!name) return;
            await createAndOpen(name, cloneJSON(EMPTY_ROSTER_DRAFT) as JSON_Unknown);
          }catch(e){
            setErr(errorToString(e));
          }
        }}
      >Create New Draft</button>
      <button
        onClick={async ()=>{
          try {
            const file = await pickSingleFile();
            if(!file) return;
            const json = JSON.parse(await file.text());
            const draftCast = ROSTERLOCK_V1_DRAFT_CASTER_JSONSCHEMA.safeCast(json, true);
            if(!draftCast.valid) throw new Error("Invalid Draft File");
            const name = prompt("Name the imported draft", file.name.replace(/\.rosterlock\.draft\.json$|\.json$/, ""));
            if(!name) return;
            await createAndOpen(name, json);
          }catch(e){
            setErr(errorToString(e));
          }
        }}
      >Import Draft File</button>
      <button
        onClick={async ()=>{
          try {
            const file = await pickSingleFile();
            if(!file) return;
            const json = JSON.parse(await file.text());
            const lockCast = ROSTERLOCK_V1_CASTER_JSONSCHEMA.safeCast(json, true);
            if(!lockCast.valid) throw new Error("Invalid Lock File");
            const name = prompt("Name the new draft", file.name.replace(/\.rosterlock\.json$|\.json$/, ""));
            if(!name) return;
            const draft = cloneJSON(EMPTY_ROSTER_DRAFT);
            draft.previousLock = lockCast.value;
            draft.stagedLock = lockCast.value;
            await createAndOpen(name, draft as JSON_Unknown);
          }catch(e){
            setErr(errorToString(e));
          }
        }}
      >New Draft from Lock File</button>
    </div>
    {err && <div className="error">{err}</div>}
  </div>;
}

function DraftList(){
  const openDraft = useOpenDraft();
  const [drafts, setDrafts] = useState<null | Array<DraftSummary>>(null);
  const [err, setErr] = useState<null | string>(null);

  const refresh = useCallback(()=>{
    listDrafts().then(setDrafts, (e)=>setErr(errorToString(e)));
  }, []);
  useEffect(refresh, [refresh]);

  if(err) return <div className="section error">Failed to list drafts: {err}</div>;
  if(!drafts) return <div className="section">Loading drafts...</div>;

  return <div className="section">
    <h3>Drafts</h3>
    {drafts.length === 0 && <p>No drafts yet</p>}
    <div style={{ display: "grid", gap: "8px" }}>
      {drafts.map((draft)=>(
        <div
          key={draft.id}
          style={{ padding: "5px", border: "solid 1px #000", borderRadius: "5px" }}
        >
          <div>
            <a
              href="#"
              onClick={async (e)=>{
                e.preventDefault();
                try {
                  await openDraft(draft.id);
                }catch(error){
                  setErr(errorToString(error));
                }
              }}
            >{draft.name}</a>
          </div>
          <div>Last saved: {new Date(draft.updatedAt).toLocaleString()}</div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={async ()=>{
                const record = await getDraft(draft.id);
                if(!record) return refresh();
                downloadFile(
                  `${record.name}.rosterlock.draft.json`,
                  JSON.stringify(record.contents, null, 2),
                  "application/json"
                );
              }}
            >Export</button>
            <button
              onClick={async ()=>{
                if(!confirm(`Delete draft "${draft.name}"? This cannot be undone.`)) return;
                await deleteDraft(draft.id);
                refresh();
              }}
            >Delete</button>
          </div>
        </div>
      ))}
    </div>
  </div>;
}
