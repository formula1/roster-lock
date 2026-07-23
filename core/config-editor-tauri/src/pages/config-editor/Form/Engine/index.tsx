
import type { RosterLockV1Draft } from "@roster-lock/types";
import type { InputProps } from "../../../../utils/react/input";
import { PieceDefinitions } from "./PieceDefinitions";
export { EngineLegend } from "./Legend";

export function EngineConfigForm({ value, onChange }: InputProps<RosterLockV1Draft["stagedLock"]>){
  const engine = value.engine;
  return <>
    <div className="section">
      <h2>Engine Config</h2>
      <div>
        <div>Engine Name</div>
        <input
          type="text"
          value={engine.name}
          onChange={e => onChange({ ...value, engine: { ...engine, name: e.target.value } })}
        />
      </div>
      <div>
        <div>Engine Version</div>
        <input
          type="text"
          value={engine.version}
          onChange={e => onChange({ ...value, engine: { ...engine, version: e.target.value } })}
        />
      </div>
    </div>
    <PieceDefinitions
      value={engine.pieceDefinitions}
      onChange={v => onChange({ ...value, engine: { ...engine, pieceDefinitions: v } })}
      config={value}
      setConfig={onChange}
    />
  </>
}

import { useFollowButtons } from "../Contexts/Buttons";
import { useRosterLock } from "../Contexts/RosterLock";
import { EngineLegend } from "./Legend";

import { FollowButtonForm } from "../../../../components/FollowButtonForm";
import { usePageInfo } from "../../Contexts/PageTitle";
import { useEffect } from "react";

export function EngineEditPage(){
  const { value, onChange } = useRosterLock();
  const buttons = useFollowButtons();
  const { onChange: setPageInfo } = usePageInfo();

  useEffect(()=>{
    setPageInfo({
      title: "New Engine Config",
      note: <EngineLegend config={value} />
    });

  }, [value]);

  return <>
      <EngineConfigForm
        value={value}
        onChange={onChange}
      />
  </>
}
