
import type { RosterLockV1Draft } from "@roster-lock/types";
import type { InputProps } from "../../../../utils/react/input";
import { PieceCollection } from "./PieceCollection";
export { PieceRosterLegend } from "./Legend";

export * from "./resetPieces"

import { useEffect } from "react";
import { resetPieces } from "./resetPieces";
import { useRosterLock } from "../Contexts/RosterLock";
import { useDraftInfo } from "../Contexts/DraftInfo";

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
import { AddPieceFromFolder } from "./PieceCollection/AddPieceFromFolder";

export function RosterConfigEditPage(){
  const { value, onChange } = useRosterLock();
  const { value: draft, onChange: onDraftChange } = useDraftInfo()
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
      <AddPieceFromFolder
        rosterLock={value}
        onSubmit={({ pieceDefinitionKey, piece, draftInfo })=>{
          onChange((old)=>({
            ...old,
            rosters: {
              ...old.rosters,
              [pieceDefinitionKey]: [
                ...old.rosters[pieceDefinitionKey],
                piece
              ]
            }
          }))
          onDraftChange((old)=>({
            ...old,
            [pieceDefinitionKey]: {
              ...old[pieceDefinitionKey],
              [piece.id]: draftInfo
            }
          }))
        }}
      />
      <RosterConfigForm
        value={value}
        onChange={onChange}
      />
    </FollowButtonForm>
  </div>
}
