import { createContext, useContext, ReactNode } from "react";
import { RosterLockV1Config } from "@roster-lock/types";

// Everything under SelectionBoard needs to ask match-agent about the same
// game launcher and the same engine - which pieces are downloaded, what a
// piece's preview looks like. It's context rather than props because the
// deepest consumer is PieceCard, one per roster entry and three components
// below where these values are actually known.
export type SelectionSource = {
  pluginName: string,
  engine: RosterLockV1Config["engine"],
  matchAgentUrl: string,
  matchAgentAuth: string,
};

const SelectionSourceContext = createContext<SelectionSource | null>(null);

export function SelectionSourceProvider({ value, children }: { value: SelectionSource, children: ReactNode }) {
  return <SelectionSourceContext.Provider value={value}>{children}</SelectionSourceContext.Provider>;
}

export function useSelectionSource(): SelectionSource {
  const ctx = useContext(SelectionSourceContext);
  if (!ctx) throw new Error("useSelectionSource must be used within a SelectionSourceProvider");
  return ctx;
}
