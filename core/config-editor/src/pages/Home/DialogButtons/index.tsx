import { useNavigate } from "react-router";
import { RosterLockPaths  } from "../../config-editor";
import { replaceParams } from "../../../utils/router";
import { useState } from "react";
import { errorToString } from "../../../utils/error";
import { openDraft } from "./openDraft";
import { newDraftFromLock } from "./newDraftFromLock";
import { newDraft } from "./newDraft";

export function DialogButtons(){
  const navigate = useNavigate();
  const [err, setErr] = useState<null | string>(null)

  return <>
    <div>
      <button
        onClick={async ()=>{
          try {
            const filePath = await newDraft()
            if(!filePath) return;
            navigate(replaceParams(
              RosterLockPaths.Root, { filePath: encodeURIComponent(filePath) }
            ))
          }catch(e){
            setErr(errorToString(e))
          }
        }}
      >Create New Draft...</button>
      <button
        onClick={async () => {
        try {

          const filePath = await openDraft()
          if(!filePath) return;
          return navigate(replaceParams(
            RosterLockPaths.Root, { filePath: encodeURIComponent(filePath) }
          ))
        } catch (error) {
          console.error('Error opening file:', error);
          setErr(errorToString(error))
        }
      }}
      >Open Existing Draft...</button>
      <button
        onClick={async () => {
        try {
          const filePath = await newDraftFromLock();
          if(!filePath) return;
          return navigate(replaceParams(
            RosterLockPaths.Root, { filePath: encodeURIComponent(filePath) }
          ))
        } catch (error) {
          console.error('Error opening file:', error);
          setErr(errorToString(error))
        }
      }}
      >New Draft from Lock file...</button>
    </div>

    {err && <div className="error" >{err}</div>}
  </>
}
