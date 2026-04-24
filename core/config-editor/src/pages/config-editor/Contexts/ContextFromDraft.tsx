import { PropsWithChildren } from "react";
import { StateInputProps } from "../../../utils/react";

import { RosterLockV1Draft } from "@roster-lock/types";
import { DraftInfoProvider } from "../Form/Contexts/DraftInfo";
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
      value={props.value.draftPieceInfo}
      onChange={(draftPieceInfo)=>(
        props.onChange((oldFullValue)=>{
          draftPieceInfo = (
            typeof draftPieceInfo !== "function" ? draftPieceInfo :
            draftPieceInfo(oldFullValue.draftPieceInfo)
          );
          return { ...oldFullValue, draftPieceInfo };
        })
      )}
    >
      {props.children}
    </DraftInfoProvider>
    </RosterLockProvider>
  )
}
