
import { createContext, useContext, useState } from "react";
import { RosterLockV1Draft } from "@roster-lock/types";
import { StateInputProps } from "../../../../utils/react";

const NewConfigContext = createContext<StateInputProps<RosterLockV1Draft>>({
  value:   {
    configPurpose: "draft",
    configVersion: 1,
    previousVersion: "0.0.0",
    stagedLock: {
      configPurpose: "lock",
      configVersion: 1,
      author: "",
      title: "",
      version: "draft",
      engine: { name: "", version: "", pieceDefinitions: {} },
      rosters: {},
      selection: { piece: {} },
    }
  },
  onChange: () => {},
});

export const useNewConfig = () => useContext(NewConfigContext);

export function NewConfigProvider({ children }: { children: React.ReactNode }){
  const [value, setValue] = useState<RosterLockV1Draft>(  {
    configPurpose: "draft",
    configVersion: 1,
    previousVersion: "0.0.0",
    stagedLock: {
      configPurpose: "lock",
      configVersion: 1,
      author: "",
      title: "",
      version: "draft",
      engine: { name: "", version: "", pieceDefinitions: {} },
      rosters: {},
      selection: { piece: {} },
    }
  });

  return (
    <NewConfigContext.Provider value={{ value, onChange: setValue }}>
      {children}
    </NewConfigContext.Provider>
  )
}
