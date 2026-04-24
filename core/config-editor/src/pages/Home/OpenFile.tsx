import { useNavigate } from "react-router";
import { FileRosterConfigPaths, NewRosterConfigPaths  } from "../config-editor";
import { replaceParams } from "../../utils/router";
import { nativeWindow } from "../../tauri/window";
import { fs } from "../../tauri/fs";
import { useState } from "react";
import { errorToString } from "../../utils/error";
import {
  ROSTERLOCK_V1_DRAFT_CASTER_JSONSCHEMA,
  ROSTERLOCK_V1_CASTER_JSONSCHEMA
} from "@roster-lock/shared";

export function OpenFile(){
  const navigate = useNavigate();
  const [err, setErr] = useState<null | string>(null)

  return <>
    <button
      onClick={async () => {
      try {
        const result = await nativeWindow.showOpenDialog({
          title: 'Open Draft',
          properties: ['openFile'],
          filters: [
            { name: 'Config Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        });

        if(result.canceled) return;
        if(result.filePaths.length === 0) return;

        const filePath = result.filePaths[0];

        const json = await fs.readJSON(filePath);
        const draftSuccess = ROSTERLOCK_V1_DRAFT_CASTER_JSONSCHEMA.safeCast(json, true);
        if(draftSuccess.valid){
          return navigate(
            replaceParams(FileRosterConfigPaths.Root, { filePath: encodeURIComponent(filePath) })
          )
        }
        const lockSuccess = ROSTERLOCK_V1_CASTER_JSONSCHEMA.safeCast(json, true);
        if(lockSuccess.valid){
          return navigate(
            NewRosterConfigPaths.Root,
            { state: { lockContents: lockSuccess.value } }
          )
        }

        throw new Error("File should be a draft or lock file")

      } catch (error) {
        console.error('Error opening file:', error);
        setErr(errorToString(error))
      }
    }}
    >Open Draft or Lock file...</button>
    {err && <div className="error" >{err}</div>}
  </>
}
