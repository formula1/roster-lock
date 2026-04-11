import { useState } from "react";
import type { RosterLockEngineConfig } from "@roster-lock/types";

export function AssetDefinitionCreator(
  { validate, onSubmit }: {
    validate: (v: string)=>unknown,
    onSubmit: (v: RosterLockEngineConfig["pieceDefinitions"][string]["assets"][number])=>unknown,
  }
){
  const [name, setName] = useState("");
  const [error, setError] = useState<null | string>(null);
  return <form
      className="section"
      onSubmit={(e)=>{
        e.preventDefault();
        try {
          if(error !== null) return;
          if(name === "") throw new Error("Name cannot be empty");
          validate(name);
          onSubmit({
            name,
            classification: "logic",
            count: 1,
            glob: [],
          });
          setName("");
        }catch(error){
          setError((error as Error).message);
        }
      }}
    >
    <h3>Create Asset</h3>
    <div>
      <input
        type="text" placeholder="Asset Name..."
        value={name}
        onChange={(e)=>{
          try {
            setName(e.target.value)
            setError(null);
            validate(e.target.value);
          }catch(error){
            setError((error as Error).message);
          }
        }}
      />
      <button
        disabled={!!error || name === ""}
        type="submit"
      >Add</button>
    </div>
    {error !== null && <div className="error">{error}</div>}
  </form>
}
