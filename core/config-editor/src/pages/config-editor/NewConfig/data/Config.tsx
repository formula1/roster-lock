
import { createContext, useContext, useState } from "react";
import { RosterLockV1Config, RosterLockV1Draft } from "@roster-lock/types";
import { StateInputProps } from "../../../../utils/react";
import { useLocation } from "react-router";
import { ROSTERLOCK_V1_CASTER_JSONSCHEMA } from "@roster-lock/shared";

const EMPTY_DRAFT: RosterLockV1Draft = {
  configPurpose: "draft",
  configVersion: 1,
  stagedLock: {
    configPurpose: "lock",
    configVersion: 1,
    author: "",
    title: "",
    version: "draft",
    engine: { name: "", version: "", pieceDefinitions: {} },
    rosters: {},
    selection: { piece: {} },
  },
  draftPieceInfo: {}
};

const NewConfigContext = createContext<StateInputProps<RosterLockV1Draft>>({
  value: EMPTY_DRAFT,
  onChange: () => {},
});

export const useNewConfig = () => useContext(NewConfigContext);

export function NewConfigProvider({ children }: { children: React.ReactNode }){
  const { state } = useLocation();
  const [value, setValue] = useState<RosterLockV1Draft>(() => initialDraftFromState(state));

  return (
    <NewConfigContext.Provider value={{ value, onChange: setValue }}>
      {children}
    </NewConfigContext.Provider>
  )
}

function initialDraftFromState(state: unknown): RosterLockV1Draft {
  if (!state || typeof state !== "object") return EMPTY_DRAFT;
  if (!("lockContents" in state)) return EMPTY_DRAFT;
  const lock = (state as { lockContents: RosterLockV1Config }).lockContents;
  const castResult = ROSTERLOCK_V1_CASTER_JSONSCHEMA.safeCast(lock, true);
  if (!castResult.valid) return EMPTY_DRAFT;
  return {
    configPurpose: "draft",
    configVersion: 1,
    stagedLock: castResult.value,
    draftPieceInfo: {},
  };
}
