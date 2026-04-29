
import { FollowButtonConfig } from "../../../../components/FollowButtonForm";
import { createContext, PropsWithChildren, useContext, useCallback } from "react";

const FollowButtonContext = createContext<Array<FollowButtonConfig>>([])

export function useFollowButtons(){
  return useContext(FollowButtonContext)
}
export function FollowButtonsProvider(
  props: PropsWithChildren<{ buttons: Array<FollowButtonConfig> }>
){
  return (
  <FollowButtonContext.Provider
    value={props.buttons}
  >
    {props.children}
  </FollowButtonContext.Provider>
  )
}


