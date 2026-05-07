import { useState } from "react";
import { RosterLockV1Config } from "@roster-lock/types";
import { InputProps } from "../../../../../../../utils/react";
import { useLightbox } from "../../../../../../../components";

import { FileView } from "../Views";

type ScriptDictionary = RosterLockV1Config["selection"]["scriptDictionary"];
type Script = ScriptDictionary[string];
export function FileSummary(
  { value, onChange, onRemove, allEntries }: (
    & InputProps<{ path: string, file: Script }>
    & { onRemove: ()=>any }
    & { allEntries: ScriptDictionary }
  )
){
  const lightbox = useLightbox()
  const [editedPath, setEditedPath] = useState(value.path);
  const isDuplicate = editedPath !== value.path && editedPath in allEntries;
  return (
    <>
      <div>
        <span>Path: </span>
        <input
          type="text"
          value={editedPath}
          onChange={(e) => {
            const newPath = e.target.value;
            setEditedPath(newPath);
            const duplicate = newPath !== value.path && newPath in allEntries;
            if (!duplicate) onChange({ ...value, path: newPath });
          }}
        />
        {isDuplicate && <span style={{ color: "#FF0000" }}>Path already exists</span>}
      </div>
      <div>
        <button
          onClick={()=>(lightbox.open(<FileView path={value.path} script={value.file} />))}
        >View Contents</button>
        <button onClick={()=>(onRemove())}>Remove</button>
      </div>
    </>
  );
}



