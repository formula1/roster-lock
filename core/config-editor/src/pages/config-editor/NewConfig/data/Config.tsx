
import { createContext, useContext, useState } from "react";
import { RosterLockV1Config } from "@roster-lock/types";
import { InputProps } from "../../../../utils/react";

const NewConfigContext = createContext<InputProps<RosterLockV1Config>>({
  value: {
    version: 1,
    engine: { name: "", version: "", pieceDefinitions: {} },
    rosters: {},
    selection: { piece: {} },
  },
  onChange: () => {},
});

export const useNewConfig = () => useContext(NewConfigContext);

export function NewConfigProvider({ children }: { children: React.ReactNode }){
  const [value, setValue] = useState<RosterLockV1Config>({
    version: 1,
    engine: { name: "", version: "", pieceDefinitions: {} },
    rosters: {},
    selection: { piece: {} },
  });

  return (
    <NewConfigContext.Provider value={{ value, onChange: setValue }}>
      {children}
    </NewConfigContext.Provider>
  )
}
