import { useState } from "react";
import { RosterLockV1Config } from "@roster-lock/types";
import { validateGlobItem, validatePathVariablesInGlob } from "@roster-lock/shared";
import { ToolTipSpan } from "../../../../../../../components/ToolTip";
import { InputError } from "../../../../../../../components/InputError";
import type { InputProps, ListItemProps } from "../../../../../../../utils/react";
import GlobTT from "./GlobTT.md";
import { GlobHighlightInput } from "./GlobHighlightInput";

type RosterLockEngineConfig = RosterLockV1Config["engine"];

export function GlobListInput(
  { value, onChange, pathVariables }: (
    & InputProps<RosterLockEngineConfig["pieceDefinitions"][string]["assets"][number]["glob"]>
    & { pathVariables: RosterLockEngineConfig["pieceDefinitions"][string]["pathVariables"] }
  )
){
  return <>
    <h3><ToolTipSpan tip={GlobTT}>Glob</ToolTipSpan></h3>
    <div>
      <GlobCreator
        onSubmit={(v) => onChange([...value, v])}
        validator={(v) => validateGlob(v, pathVariables, -1, value)}
        pathVariables={pathVariables}
      />
      {value.map((glob, index) => (
        <GlobItem
          key={`${index}-${glob}`}
          value={value[index]}
          onChange={v => onChange(value.map((oldGlob, i) => i !== index ? oldGlob : v))}
          validator={(v) => validateGlob(v, pathVariables, index, value)}

          index={index}
          items={value}
          onDelete={() => onChange(value.filter((_, i) => i !== index))}
          pathVariables={pathVariables}
        />
      ))}
    </div>
  </>
}

function GlobCreator(
  { onSubmit, validator, pathVariables }: {
    validator: (v: string)=>unknown,
    onSubmit: (v: string)=>unknown,
    pathVariables: Array<string>,
  }
){
  const [newGlob, setNewGlob] = useState("");
  const [error, setError] = useState<null | string>(null);
  return <>
    <div>Add Glob</div>
    <form onSubmit={(e)=>{
        e.preventDefault();
        try{
          if(error !== null) return;
          if(newGlob === "") throw new Error("Glob cannot be empty");
          validator(newGlob);
          onSubmit(newGlob);
          setNewGlob("");
        }catch(e){
          setError((e as Error).message);
        }
      }}>
      <GlobHighlightInput
        value={newGlob}
        onChange={(v)=>{
          try {
            setError(null);
            setNewGlob(v);
            validator(v);
          }catch(error){
            setError((error as Error).message);
          }
        }}
        placeholder="e.g. **/*.png"
        className="glob-highlight-input"
        pathVariables={pathVariables}
      />
      <button
        disabled={newGlob === "" || error !== null}
        type="submit"
        >Add</button>
    </form>
    {error !== null && <div className="error">{error}</div>}
  </>
}

function GlobItem({ value, onChange, onDelete, validator, pathVariables }: (
  & InputProps<string>
  & ListItemProps<string>
  & { validator: (v: string)=>unknown }
  & { pathVariables: Array<string> }
)){
  const [newGlob, setNewGlob] = useState(value);
  const [error, setError] = useState<null | string>(null);

  return <>
    <div >
      <GlobHighlightInput
        value={newGlob}
        onChange={(v)=>{
          try {
            setNewGlob(v);
            setError(null);
            validator(v);
          }catch(error){
            setError((error as Error).message);
          }
        }}
        onBlur={() => {
          if(error !== null) return;
          onChange(newGlob);
        }}
        className="glob-highlight-input"
        pathVariables={pathVariables}
      />
      <button
        onClick={()=> onDelete()}
      >Remove</button>
    </div>
    {error !== null && <InputError>{error}</InputError>}
  </>;
}

function validateGlob(
  value: string, pathVariables: Array<string>, index: number, list: Array<string>
){
  validatePathVariablesInGlob(value, pathVariables);
  validateGlobItem(value);
  // Check for duplicate globs
  for(let i = 0; i < list.length; i++){
    if(i === index) continue;
    if(list[i] === value) throw new Error("Duplicate Glob");
  }
}
