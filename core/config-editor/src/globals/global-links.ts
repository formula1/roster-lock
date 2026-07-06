import { createContext, useContext } from "react";
import { Page } from "../components/Tabs";

type GlobalLinksState = [Array<Page>, (newPages: Array<Page>)=>any];
export const GlobalLinksContext = createContext<GlobalLinksState>(
  [[], ()=>{throw new Error("Global links need a provider");}]
);


export function useGlobalLinks(){
  return useContext(GlobalLinksContext);
}
