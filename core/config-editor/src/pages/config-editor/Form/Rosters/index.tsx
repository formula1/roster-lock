
import { PageArrayTabs } from "../../../../components/Tabs";

import type { RosterLockV1Config } from "@roster-lock/types";
import type { InputProps } from "../../../../utils/react/input";
import { PieceCollection } from "./PieceCollection";
export { PieceRosterLegend } from "./Legend";

export * from "./resetPieces"

import { useEffect } from "react";
import { resetPieces } from "./resetPieces";

export function RosterConfigForm({ value, onChange }: InputProps<RosterLockV1Config>){

  useEffect(()=>{
    onChange({ ...value, rosters: resetPieces(value.engine, value.rosters) });
  }, [value.engine])

  return <>
    <PieceCollection
      value={value.rosters}
      onChange={v => onChange({ ...value, rosters: v })}
      config={value}
    />
  </>
}
