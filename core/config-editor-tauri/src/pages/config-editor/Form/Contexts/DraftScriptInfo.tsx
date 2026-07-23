
import { createContext, PropsWithChildren, useContext } from "react";
import { StateInputProps } from "../../../../utils/react/input";
import { RosterLockV1Draft } from "@roster-lock/types";

type DraftScriptInfo = NonNullable<RosterLockV1Draft["draft"]["selectionScriptInfo"]>;

const DraftScriptInfoContext = createContext<StateInputProps<DraftScriptInfo>>({
  value: {},
  onChange: () => { throw new Error("Provider Required"); }
});

export function useDraftScriptInfo() {
  return useContext(DraftScriptInfoContext);
}

export function DraftScriptInfoProvider(props: PropsWithChildren<StateInputProps<DraftScriptInfo>>) {
  return (
    <DraftScriptInfoContext.Provider
      value={{ value: props.value, onChange: props.onChange }}
    >
      {props.children}
    </DraftScriptInfoContext.Provider>
  );
}
