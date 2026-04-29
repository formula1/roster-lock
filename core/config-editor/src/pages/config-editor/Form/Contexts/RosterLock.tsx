

import { createContext, PropsWithChildren, useContext, useCallback } from "react";
import { StateInputProps } from "../../../../utils/react/input";

import { RosterLockV1Config } from "@roster-lock/types";
import { EMPTY_ROSTER_LOCK } from "../constants/roster-configs";

const RosterLockContext = createContext<StateInputProps<RosterLockV1Config>>({
  value: EMPTY_ROSTER_LOCK,
  onChange: ()=>{throw new Error("Provider Required");}
})

export function useRosterLock(){
  return useContext(RosterLockContext)
}
export function RosterLockProvider(props: PropsWithChildren<StateInputProps<RosterLockV1Config>>){
  return (
  <RosterLockContext.Provider
    value={{ value: props.value, onChange: props.onChange }}
  >
    {props.children}
  </RosterLockContext.Provider>
  )
}
