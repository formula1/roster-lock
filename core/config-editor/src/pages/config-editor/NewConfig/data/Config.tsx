
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { RosterLockV1Config, RosterLockV1Draft } from "@roster-lock/types";
import { StateInputProps } from "../../../../utils/react";
import { useLocation } from "react-router";
import { ROSTERLOCK_V1_CASTER_JSONSCHEMA } from "@roster-lock/shared";
import { cloneJSON } from "@roster-lock/utils";

import { EMPTY_ROSTER_DRAFT } from "../../Form/constants/roster-configs";


const NewConfigContext = createContext<(
  & StateInputProps<RosterLockV1Draft>
  & { reset: ()=>any }
)>({
  value: EMPTY_ROSTER_DRAFT,
  onChange: () => {},
  reset: ()=>{},
});

export const useNewConfig = () => useContext(NewConfigContext);

export function NewConfigProvider({ children }: { children: React.ReactNode }){
  const { state } = useLocation();
  const initialState = useMemo(()=>{
    return initialDraftFromState(state)
  }, [])
  const [value, setValue] = useState<RosterLockV1Draft>(cloneJSON(initialState));
  const reset = useCallback(()=>{
    setValue(cloneJSON(initialState))
  }, [])

  return (
    <NewConfigContext.Provider value={{ value, onChange: setValue, reset }}>
      {children}
    </NewConfigContext.Provider>
  )
}

function initialDraftFromState(state: unknown): RosterLockV1Draft {
  if (!state || typeof state !== "object") return cloneJSON(EMPTY_ROSTER_DRAFT);
  if (!("lockContents" in state)) return cloneJSON(EMPTY_ROSTER_DRAFT);
  const lock = (state as { lockContents: RosterLockV1Config }).lockContents;
  const castResult = ROSTERLOCK_V1_CASTER_JSONSCHEMA.safeCast(lock, true);
  if (!castResult.valid) return cloneJSON(EMPTY_ROSTER_DRAFT);
  return {
    configIdentity: { namespace: "roster-lock", purpose: "draft", version: 1 },
    previousLock: cloneJSON(castResult.value),
    stagedLock: cloneJSON(castResult.value),
    draftPieceInfo: {},
  };
}
