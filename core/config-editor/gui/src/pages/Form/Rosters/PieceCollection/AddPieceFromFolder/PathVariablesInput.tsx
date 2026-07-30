import { RosterLockEngineConfig } from "@roster-lock/types";
import { InputProps } from "../../../../../utils/react";
import { useEffect, useState } from "react";
import { validatePathVariableValue } from "@roster-lock/shared";


export function PathVariableValuesInput(
  { value, onChange, pathVariables }: (
    & InputProps<Record<string, string>>
    & { pathVariables: RosterLockEngineConfig["pieceDefinitions"][string]["pathVariables"] }
  )
){

  useEffect(() => {
    onChange(
      Object.fromEntries(
        pathVariables.map((variable) => [variable, value[variable] || ""])
      )
    );
  }, [pathVariables]);  

return <>
    <h3>Path Variables</h3>
    {pathVariables.map((variable) => (
      <PathVariableValue
        key={variable}
        value={value[variable]}
        onChange={v => onChange({ ...value, [variable]: v })}
        variableName={variable}
      />
    ))}
  </>
}

function PathVariableValue(
  { value, onChange, variableName }: (
    & InputProps<string>
    & { variableName: string }
  )
){
  const [error, setError] = useState<null | string>(null);
  return (
    <div>
      <label>
        {variableName}
        <input
          type="text"
          value={value}
          onChange={e =>{
            try {
              onChange(e.target.value);
              validatePathVariableValue(e.target.value);
              setError(null);
            }catch(error){
              setError((error as Error).message);
            }
          }}
        />
      </label>
      {error !== null && <div className="error">{error}</div>}
    </div>
  )
}
