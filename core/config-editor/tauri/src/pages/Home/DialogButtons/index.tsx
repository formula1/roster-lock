import { useState } from "react";
import { errorToString } from "../../../utils/error";
import { useOpenDraftFile } from "../../../host/config-source";
import { openDraft } from "./openDraft";
import { newDraftFromLock } from "./newDraftFromLock";
import { newDraft } from "./newDraft";
import "./buttons.css";

export function DialogButtons(){
  const openFile = useOpenDraftFile();
  const [err, setErr] = useState<null | string>(null)

  return <>
    <div className="home-buttons-container">
      <button
        onClick={async ()=>{
          try {
            const filePath = await newDraft()
            if(!filePath) return;
            await openFile(filePath);
          }catch(e){
            setErr(errorToString(e))
          }
        }}
      >Create New Draft</button>
      <button
        onClick={async () => {
        try {

          const filePath = await openDraft()
          if(!filePath) return;
          return await openFile(filePath);
        } catch (error) {
          console.error('Error opening file:', error);
          setErr(errorToString(error))
        }
      }}
      >Open Existing Draft</button>
      <button
        onClick={async () => {
        try {
          const filePath = await newDraftFromLock();
          if(!filePath) return;
          return await openFile(filePath);
        } catch (error) {
          console.error('Error opening file:', error);
          setErr(errorToString(error))
        }
      }}
      >New Draft from Lock File</button>
    </div>

    {err && <div className="error" >{err}</div>}
  </>
}
