import { createContext, PropsWithChildren, useContext, useMemo } from "react";
import { RosterLockV1Draft } from "@roster-lock/types";

type DraftInfo = {
  pieceInfo: RosterLockV1Draft["draftPieceInfo"]
};

const DraftContext = createContext<DraftInfo>({ pieceInfo: {} });

export function useDraftInfo(){
  return useContext(DraftContext)
}

export function DraftInfoProvider({ draft, children }: PropsWithChildren<{ draft: RosterLockV1Draft }> ){

  const value = useMemo(()=>{
    return { pieceInfo: draft.draftPieceInfo };
  }, [draft.draftPieceInfo])

  return (
  <DraftContext.Provider value={value} >
    {children}
  </DraftContext.Provider>
  )
}


