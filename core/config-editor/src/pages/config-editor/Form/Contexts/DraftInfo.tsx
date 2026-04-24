

import { createContext, PropsWithChildren, useContext, useCallback } from "react";
import { StateInputProps } from "../../../../utils/react/input";

import { RosterLockV1Draft } from "@roster-lock/types";

type DraftInfo = RosterLockV1Draft["draftPieceInfo"];

const DraftInfoContext = createContext<StateInputProps<DraftInfo>>({
  value: {},
  onChange: ()=>{throw new Error("Provider Required");}
})

export function useDraftInfo(){
  return useContext(DraftInfoContext)
}
export function DraftInfoProvider(props: PropsWithChildren<StateInputProps<DraftInfo>>){
  return (
  <DraftInfoContext.Provider
    value={{ value: props.value, onChange: props.onChange }}
  >
    {props.children}
  </DraftInfoContext.Provider>
  )
}
