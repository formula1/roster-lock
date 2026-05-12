import { useCallback, useEffect, useMemo, useState } from "react";
import type { ScriptPurposeInput } from "@roster-lock/shared";
import { PieceType, SelectedPiece, UntrustedScriptRef, UserId } from "@roster-lock/types";
import { useRosterLock } from "../../../../Contexts/RosterLock";
import { ROSTERLOCK_SIDECAR } from "../../../../../../../globals/side-car";

import { replaceParams } from "../../../../../../../utils/router";
import { RosterLockPaths } from "../../../../../paths";
import { Link, useParams } from "react-router";

import { SCRIPT_PURPOSES } from "./script-purpose";
import { ToolTipSpan } from "../../../../../../../components/ToolTip";

import { ScriptRefInput } from "../../../ScriptRef/shared";
import { ScriptPurposeSelectionInput } from "./ScriptPurposeInput";
import { UserListInput } from "../../../../components/UserListInput"
import { InputProps, RunnableState, useRunnable } from "../../../../../../../utils/react"
import { createEmptyPurposeBody } from "./createEmptyPurposebody";

export function RunScriptPage(){
  const params = useParams();
  const filePath = params.filePath || ""
  const { value: lock } = useRosterLock();
  const scriptDictionary = lock.selection.scriptDictionary
  const [scriptRef, setScriptRef] = useState<UntrustedScriptRef | null>(null)
  const [randomSeed, setRandomSeed] = useState("");
  const [users, setUsers] = useState<Array<string>>([])
  const [purposeBody, setPurposeBody] = useState<ScriptPurposeInput>({
    type: "global-validation",
    pieceTypes: [],
    users: [],
    input: {}
  })
  useEffect(()=>{
    const scriptSources = Object.keys(scriptDictionary);
    if(scriptSources.length === 0) return;
    setScriptRef({ src: scriptSources[0] });
  }, [scriptDictionary])

  const validateablePieces = useMemo(()=>{
    const validPieces = [];
    for(const [pieceType, piece] of Object.entries(lock.engine.pieceDefinitions)){
      if(piece.selectionStrategy === "mandatory") continue;
      if(piece.selectionStrategy === "on demand") continue;
      validPieces.push({ pieceType, piece });
    }
    return validPieces;
  }, [lock])

  if(!scriptRef){
    return (
      <>
        <h1 className="error" >No Scripts to run</h1>
        <h3>
          <Link
            to={replaceParams(
              RosterLockPaths.Selection.ScriptDictionary.MergeFolder,
              { filePath }
            )}
          >Merge a Folder</Link>
        </h3>
      </>
    )
  }
  if(purposeBody.type !== "global-validation" && validateablePieces.length === 0){
    return (
      <>
        <h1 className="error" >No valid piece type</h1>
        <h3>
          <Link
            to={replaceParams(
              RosterLockPaths.Engine,
              { filePath }
            )}
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
      <RandomSeedInput
        value={randomSeed}
        onChange={setRandomSeed}
      />
      <UserListInput
        value={users} onChange={(newUsers)=>{
          setUsers(newUsers);
          if(purposeBody.type === "piece-user-validation") return;
          if(purposeBody.type === "piece-merge"){
            const newInput: Record<UserId, Array<SelectedPiece>> = {};
            for(const user of newUsers){
              newInput[user] = purposeBody.input[user] || []
            }
            setPurposeBody({ ...purposeBody, users: newUsers, input: newInput })
            return;
          }
          if(purposeBody.type === "global-validation"){
            const newInput: Record<PieceType, Array<SelectedPiece> | Record<UserId, Array<SelectedPiece>>> = {};
            for(const [pieceType, def] of Object.entries(lock.engine.pieceDefinitions)){
              if(def.selectionStrategy === "mandatory" || def.selectionStrategy === "on demand"){
                continue
              }
              newInput[pieceType] = {}
              const oldInput = purposeBody.input[pieceType];
              if(def.selectionStrategy === "shared"){
                newInput[pieceType] = Array.isArray(oldInput) ? oldInput : []
                continue;
              }
              const isMap = !Array.isArray(oldInput);
              for(const user of newUsers){
                newInput[pieceType][user] = !oldInput ? [] : !isMap ? [] : oldInput[user]
              }
            }
            setPurposeBody({ ...purposeBody, users: newUsers, input: newInput });
            return;
          }
          throw new Error("Invalid purpose body type " + (purposeBody as any).type);
        }}
      />
      <div>
        <div><span>Purpose: </span></div>
        {SCRIPT_PURPOSES.map((purposeItem)=>(
          <div
            onClick={()=>{
              setPurposeBody(createEmptyPurposeBody(lock, purposeItem.value, users))
            }}
          >
            <input
              type="radio" name="purpose" value={purposeItem.value}
              checked={purposeItem.value === purposeBody.type}
            />
            <ToolTipSpan tip={purposeItem.description}>{purposeItem.title}</ToolTipSpan>
          </div>
        ))}
      </div>
      {purposeBody.type !== "global-validation" && (
        <div>
          <span>Piece Type: </span>
          <select
            value={purposeBody.pieceType}
            onChange={(e)=>{setPurposeBody({ ...purposeBody, pieceType: e.target.value })}}
          >
            {validateablePieces.map(({ pieceType, piece })=>(
              <option value={pieceType}>{pieceType} ({piece.selectionStrategy})</option>
            ))}
          </select>
        </div>
      )}
      <ScriptPurposeSelectionInput
        value={purposeBody}
        onChange={setPurposeBody}
      />
      <ScriptRunner
        script={scriptRef}
        purposeBody={purposeBody}
        users={users}
        seedPrefix={randomSeed}
      />
    </>
  )
}

export function RandomSeedInput(
  { value, onChange }: InputProps<string>
){
  return (
    <div>
      <span>Random Seed</span>
      <input type="text" value={value} onChange={(e)=>(onChange(e.target.value))} />
    </div>
  )
}

export function ScriptRunner(
  { script, purposeBody, users, seedPrefix }: {
    script: UntrustedScriptRef,
    purposeBody: ScriptPurposeInput,
    users: Array<string>,
    seedPrefix: string,
  }) {
  const { value: lock } = useRosterLock();

  const runResult = useRunnable(
    useCallback(()=>{
      return ROSTERLOCK_SIDECAR.runScript({
        config: lock,
        purpose: purposeBody,
        randomSeeds: [seedPrefix],
        entryScript: script
      });
    }, [lock, purposeBody, seedPrefix, script])
  )


  const running = runResult.state === RunnableState.PENDING
  return (
    <div className="section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h5 style={{ margin: 0 }}>Test Runner</h5>
      </div>

      <button type="button" onClick={runResult.run} disabled={running}>
        {running ? "Running…" : "Run"}
      </button>
      {runResult.state === RunnableState.FAILED ? (
        <div style={{ border: "#FF0000 1px solid"}}>
          <h5 className="error">Error</h5>
          <pre>{JSON.stringify(runResult.error)}</pre>
        </div>
      ) : runResult.state === RunnableState.SUCCESS ? (
        <div style={{ border: "#00FF00 1px solid"}}>
          <h5>Success</h5>
          <pre>{JSON.stringify(runResult.value)}</pre>
        </div>
      ) : null}
    </div>
  );
}

