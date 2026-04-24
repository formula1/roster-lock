
import type { RosterLockV1Draft } from "@roster-lock/types";
import type { InputProps } from "../../../../utils/react/input";
import { PieceCollection } from "./PieceCollection";
export { PieceRosterLegend } from "./Legend";

export * from "./resetPieces"

import { useEffect } from "react";
import { resetPieces } from "./resetPieces";
import { useRosterLock } from "../Contexts/RosterLock";

type RosterLockV1Config = RosterLockV1Draft["stagedLock"];

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


import { useFollowButtons } from "../Contexts/Buttons";
import { PieceRosterLegend } from "./Legend";

import { FollowButtonForm } from "../../../../components/FollowButtonForm";

export function RosterConfigEditPage(){
  const { value, onChange } = useRosterLock();
  const buttons = useFollowButtons();
  

  return <div style={{ overflow: "hidden", flexGrow: 1 }}>
    <h1>New Engine Config</h1>
    <FollowButtonForm
      info={{
        title: "Roster Config",
        note: <PieceRosterLegend rosters={value.rosters} />,
      }}
      buttons={buttons}
    >
      <RosterConfigForm
        value={value}
        onChange={onChange}
      />
    </FollowButtonForm>
  </div>
}
