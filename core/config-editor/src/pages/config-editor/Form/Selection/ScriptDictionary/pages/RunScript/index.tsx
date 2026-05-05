import { useEffect, useMemo, useState } from "react";
import type { ScriptPurposeInput } from "@roster-lock/shared";
import { UntrustedScriptRef } from "@roster-lock/types";
import { useDraftScriptInfo } from "../../../../Contexts/DraftScriptInfo";
import { useRosterLock } from "../../../../Contexts/RosterLock";
import { ROSTERLOCK_SIDECAR } from "../../../../../../../globals/side-car";

import { join as joinPaths } from "../../../../../../../utils/router";
import { useURLPrefix } from "../../../../Contexts/UrlPrefix";
import { RosterLockPaths } from "../../../../paths";
import { Link } from "react-router";
import { useLightbox } from "../../../../../../../components/LightBox";
import { FileView } from "../Views";

import { defaultPurposeInput, SCRIPT_PURPOSES, ScriptPurpose } from "./script-purpose";
import { ToolTipSpan } from "../../../../../../../components/ToolTip";

import { ScriptRefInput } from "../../../ScriptRef/shared";

export function RunScriptPage(){
  const urlPrefix = useURLPrefix();
  const lightbox = useLightbox();
  const { value: lock } = useRosterLock();
  const scriptDictionary = lock.selection.scriptDictionary
  const [scriptRef, setScriptRef] = useState<UntrustedScriptRef | null>(null)
  const [purpose, setPurpose] = useState(SCRIPT_PURPOSES[0].value);
  const [pieceType, setPieceType] = useState<undefined | string>(void 0)
  useEffect(()=>{
    const scriptSources = Object.keys(scriptDictionary);
    if(scriptSources.length === 0) return;
    setScriptRef({ src: scriptSources[0] });
  }, [lock])

  const validateablePieces = useMemo(()=>{
    const validPieces = [];
    for(const [pieceType, piece] of Object.entries(lock.engine.pieceDefinitions)){
      if(piece.selectionStrategy !== "mandatory" && piece.selectionStrategy !== "on demand"){
        validPieces.push({ pieceType, piece });
      }
    }
    return validPieces;
  }, [lock])

  useEffect(()=>{
    // If global validation, no piece should be set
    if(purpose === "global-validation"){
      setPieceType(void 0);
      return;
    }
    // otherwise, if no piece was set then we should set one
    if(pieceType === void 0){
      if(validateablePieces.length === 0) return;
      setPieceType(validateablePieces[0].pieceType)
    }
  }, [purpose, pieceType]);

  if(!scriptRef){
    return (
      <>
        <h1 className="error" >No Scripts to run</h1>
        <h3>
          <Link
            to={(joinPaths(urlPrefix, RosterLockPaths.Selection.ScriptDictionary.MergeFolder))}
          >Merge a Folder</Link>
        </h3>
      </>
    )
  }
  if(purpose !== "global-validation" && pieceType === void 0){
    return (
      <>
        <h1 className="error" >No valid piece type</h1>
        <h3>
          <Link
            to={(joinPaths(urlPrefix, RosterLockPaths.Engine))}
          >Add a new Piece</Link>
        </h3>
      </>
    )
  }
  return (
    <>
      <ScriptRefInput
        value={scriptRef}
        onChange={(newScriptRef)=>(setScriptRef(newScriptRef))}
      />
      <div>
        <div><span>Purpose: </span></div>
        {SCRIPT_PURPOSES.map((purposeItem)=>(
          <div onClick={()=>(setPurpose(purposeItem.value))}>
            <input
              type="radio" name="purpose" value={purposeItem.value}
              checked={purposeItem.value === purpose}
            />
            <ToolTipSpan tip={purposeItem.description}>{purposeItem.title}</ToolTipSpan>
          </div>
        ))}
      </div>
      {purpose !== "global-validation" && (
        <div>
          <span>Piece Type: </span>
          <select value={pieceType} onChange={(e)=>{setPieceType(e.target.value)}}>
            {validateablePieces.map(({ pieceType, piece })=>(
              <option value={pieceType}>{pieceType} ({piece.selectionStrategy})</option>
            ))}
          </select>
        </div>
      )}
      <ScriptRunner
        script={scriptRef}
        purpose={purpose}
        pieceType={pieceType}
      />
    </>
  )
}


type Props = {
  script: UntrustedScriptRef;
  purpose: ScriptPurpose;
  pieceType?: string;
};


export function ScriptRunner({ script, purpose, pieceType }: Props) {
  const { value: draftScriptInfo } = useDraftScriptInfo();
  const { value: config } = useRosterLock();

  const [expanded, setExpanded] = useState(false);
  const [purposeJson, setPurposeJson] = useState(
    () => JSON.stringify(defaultPurposeInput(purpose, pieceType), null, 2)
  );
  const [purposeError, setPurposeError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ output: unknown } | { error: string } | null>(null);

  const run = async () => {
    let parsedPurpose: ScriptPurposeInput;
    try {
      parsedPurpose = JSON.parse(purposeJson);
      setPurposeError(null);
    } catch {
      setPurposeError("Invalid JSON");
      return;
    }

    const scriptMapping = Object.fromEntries(
      Object.entries(draftScriptInfo).map(([rel, info]) => [rel, info.referencePath])
    );

    setRunning(true);
    setResult(null);
    try {
      const output = await ROSTERLOCK_SIDECAR.runScript({
        config,
        randomSeeds: ["test-seed"],
        purpose: parsedPurpose,
        entryScript: script
      });
      setResult({ output });
    } catch (e) {
      setResult({ error: (e as Error).message });
    } finally {
      setRunning(false);
    }
  };

  if (!expanded) {
    return (
      <button type="button" onClick={() => setExpanded(true)}>
        Run Script
      </button>
    );
  }

  return (
    <div className="section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h5 style={{ margin: 0 }}>Test Runner</h5>
        <button type="button" onClick={() => setExpanded(false)}>Close</button>
      </div>
      <div>

      </div>

      <div>
        <label>
          <div>Purpose Input (JSON)</div>
          <textarea
            rows={10}
            style={{ width: "100%", fontFamily: "monospace", fontSize: "13px" }}
            value={purposeJson}
            onChange={e => {
              setPurposeJson(e.target.value);
              setPurposeError(null);
            }}
          />
        </label>
        {purposeError && <div className="error">{purposeError}</div>}
      </div>

      <button type="button" onClick={run} disabled={running}>
        {running ? "Running…" : "Run"}
      </button>

      {result && (
        <div>
          {"error" in result ? (
            <pre style={{ color: "red", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {result.error}
            </pre>
          ) : (
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {JSON.stringify(result.output, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
