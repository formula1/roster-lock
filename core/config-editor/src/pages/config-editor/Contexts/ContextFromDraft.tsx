import { PropsWithChildren } from "react";
import { StateInputProps } from "../../../utils/react";

import { RosterLockV1Draft } from "@roster-lock/types";
import { DraftInfoProvider } from "../Form/Contexts/DraftInfo";
import { DraftScriptInfoProvider } from "../Form/Contexts/DraftScriptInfo";
import { RosterLockProvider } from "../Form/Contexts/RosterLock";

export function ContextFromDraftProvider(props: PropsWithChildren<StateInputProps<RosterLockV1Draft>>){
  return (
    <RosterLockProvider
      value={props.value.stagedLock}
      onChange={(stagedLock)=>(
        props.onChange((oldFullValue)=>{
          stagedLock = (
            typeof stagedLock !== "function" ? stagedLock :
            stagedLock(oldFullValue.stagedLock)
          );
          return { ...oldFullValue, stagedLock };
        })
      )}
    >
    <DraftInfoProvider
      value={props.value.draft.rosterPieceInfo}
      onChange={(rosterPieceInfo)=>(
        props.onChange((oldFullValue)=>{
          rosterPieceInfo = (
            typeof rosterPieceInfo !== "function" ? rosterPieceInfo :
            rosterPieceInfo(oldFullValue.draft.rosterPieceInfo)
          );
          return { ...oldFullValue, draft: { ...oldFullValue.draft, rosterPieceInfo } };
        })
      )}
    >
    <DraftScriptInfoProvider
      value={props.value.draft.selectionScriptInfo ?? {}}
      onChange={(selectionScriptInfo)=>(
        props.onChange((oldFullValue)=>{
          selectionScriptInfo = (
            typeof selectionScriptInfo !== "function" ? selectionScriptInfo :
            selectionScriptInfo(oldFullValue.draft.selectionScriptInfo ?? {})
          );
          return { ...oldFullValue, draft: { ...oldFullValue.draft, selectionScriptInfo } };
        })
      )}
    >
      {props.children}
    </DraftScriptInfoProvider>
    </DraftInfoProvider>
    </RosterLockProvider>
  )
}
