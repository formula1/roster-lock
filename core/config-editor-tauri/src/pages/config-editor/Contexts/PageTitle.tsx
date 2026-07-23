import { createContext, PropsWithChildren, ReactNode, useContext, useState } from "react";
import { StateInputProps } from "../../../utils/react";


type PageInfo = { title: string, note: ReactNode };
const PageInfoContext = createContext<StateInputProps<PageInfo>>({
  value: { title: "", note: null },
  onChange: ()=>{throw new Error("Provider Required");},
})

export function usePageInfo(){
  return useContext(PageInfoContext)
}

export function PageInfoProvider({ children }: PropsWithChildren){
  const [value, onChange] = useState<PageInfo>({ title: "", note: null });
  return (
    <PageInfoContext.Provider value={{ value, onChange }} >
      {children}
    </PageInfoContext.Provider>
  );
}



