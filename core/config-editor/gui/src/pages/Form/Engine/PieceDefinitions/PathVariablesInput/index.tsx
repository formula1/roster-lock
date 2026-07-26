import { useState } from "react";
import type { InputProps, ListItemProps } from "../../../../../utils/react/input";
import { validatePathVariableName } from "@roster-lock/shared";
import { ToolTipSpan } from "../../../../../components/ToolTip";

import PathVariablesTT from "./explain.md";

export function PathVariableNamesInput({ value, onChange }: InputProps<Array<string>>){
  return <>
    <h3><ToolTipSpan tip={PathVariablesTT} clickable>Path Variables</ToolTipSpan></h3>
    <PathVariableCreator
      validate={(v) =>{
        validatePathVariableName(v);
        if(value.includes(v)) throw new Error("Variable already exists");
      }}
      onSubmit={(v) => onChange([...value, v])}
    />
    <div className="section">
      {value.map((variable, index) => (
        <PathVariableItem
          key={`${variable}-${index}`}
          value={variable}
          onChange={(v) => onChange(value.map((oldVariable, i) => i !== index ? oldVariable : v))}

          index={index}
          items={value}
          onDelete={() => onChange(value.filter((_, i) => i !== index))}
        />
      ))}
    </div>
  </>
}

function PathVariableCreator({ validate, onSubmit }: {
  validate: (v: string)=>unknown,
  onSubmit: (v: string)=>unknown,
}){
  const [newVariable, setNewVariable] = useState("");
  const [error, setError] = useState<null | string>(null);
  return <div className="section">
    <form onSubmit={(e)=>{
        try {
          e.preventDefault();
          if(error !== null) return;
          onSubmit(newVariable);
          setNewVariable("");
        }catch(error){
          setError((error as Error).message);
        }
      }}>
      <input
        type="text"
        value={newVariable}
        onChange={(e)=>{
          try {
            setNewVariable(e.target.value)
            setError(null);
            validate(e.target.value);
          }catch(error){
            setError((error as Error).message);
          }
        }}
      />
      <button
        disabled={newVariable === "" || error !== null}
        type="submit"
      >Add</button>
    </form>
    {error !== null && <div className="error">{error}</div>}
  </div>;
}

function PathVariableItem({ value, onDelete }: (
  & InputProps<string>
  & ListItemProps<string>
)){
  return <div style={{ borderTop: "1px solid #ccc", borderBottom: "1px solid #ccc", padding: "0.5rem 0" }}>
    <div>
      <ToolTipSpan
        tip={`You can use this variable in the asset glob paths using \`<${value}>\``}
      >{value}</ToolTipSpan>
      <button
        onClick={()=> onDelete()}
      >Remove</button>
    </div>
  </div>;
}
