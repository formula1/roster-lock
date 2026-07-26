import { useEffect, useState } from "react";

export function TitleInput(
  { placeholder, originalValue, validate, onSubmit, onDelete }: (
    & { placeholder: string }
    & { originalValue: string }
    & {
      validate: (name: string)=>unknown
      onSubmit: (newName: string)=>unknown
      onDelete: ()=>unknown
    }
  )
){
  const [title, setTitle] = useState(originalValue);
  const [error, setError] = useState<null | string>(null);

  useEffect(()=>{
    if(originalValue !== title){
      setTitle(originalValue);
    }
  },[originalValue])

  return <div>
    <div className="editable-title">
      <input
        type="text"
        placeholder={placeholder}
        value={title}
        onChange={(e)=>{
          try {
            setTitle(e.target.value);
            setError(null);
            if(e.target.value === originalValue) return;
            if(e.target.value === "") throw new Error("Cannot be empty");
            validate(e.target.value);
          }catch(error){
            setError((error as Error).message);
          }
        }}
      />
      <button
        disabled={title === originalValue || error !== null}
        onClick={() => {
          try {
            validate(title);
            onSubmit(title);
          }catch(error){
            setError((error as Error).message);
          }
        }}
      >Update</button>
      <button onClick={() =>onDelete()} >Delete</button>
    </div>
    {error !== null && <div className="error">{error}</div>}
  </div>
}

