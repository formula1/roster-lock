import { useState } from "react";
import { type InputProps } from "../../../../../utils/react/input";
import type { RosterLockV1Draft } from "@roster-lock/types";
import { ToolTipSpan } from "../../../../../components/ToolTip";
import tooltip from "./piecett.md";

import { CONFIG_ID_PATHS } from "../../../paths";

type RosterLockV1Config = RosterLockV1Draft["stagedLock"]

export function PieceDefinitions(
  { value, onChange, config, setConfig }: (
    & InputProps<RosterLockV1Config["engine"]["pieceDefinitions"]>
    & { config: RosterLockV1Config, setConfig: (v: RosterLockV1Config)=>unknown }
  )
){
  return <div className="section">
    <h2><ToolTipSpan tip={tooltip} clickable>Piece Definitions</ToolTipSpan></h2>
    <PieceDefinitionCreator value={value} onChange={onChange} />
    <div className="alternate-list">
    {Object.keys(value).sort().map((pieceName) => (
      <div key={pieceName} className="section" id={CONFIG_ID_PATHS.engine.pieceId(pieceName)} >
        <PieceDefinition
          pieceName={pieceName}
          value={value}
          onChange={onChange}
          config={config}
          setConfig={setConfig}
        />
      </div>
    ))}
    </div>
  </div>
}

function PieceDefinitionCreator(
  { value, onChange }: (
    & InputProps<RosterLockV1Config["engine"]["pieceDefinitions"]>
  )
){
  const [name, setName] = useState("");
  const [error, setError] = useState<null | string>(null);
  return (
    <form
      className="section"
      onSubmit={(e)=>{
        e.preventDefault();
        try {
          setError(null);
          if(name === "") throw new Error("Name cannot be empty");
          if(value[name]) throw new Error("Name already exists");
          onChange({
            ...value,
            [name]: {
              selectionStrategy: "personal",
              requires: [],
              pathVariables: [],
              assets: []
            }
          });
          setName("");
        }catch(error){
          setError((error as Error).message);
        }
      }}
    >
      <h3>Create Piece Definition</h3>
      <div>
        <input
          type="text" placeholder="Piece Name..."
          value={name}
          onChange={(e)=>{
            setName(e.target.value)
            setError(null);
            if(value[e.target.value]) return setError("Name already exists");
          }}
        />
        <button
          disabled={!!error || name === ""}
          type="submit"
        >Create</button>
      </div>
      {error !== null && <div className="error">{error}</div>}
    </form>
  )
}

import { SelectionStrategyInput } from "./SelectionStrategyInput";
import { RequiresInput } from "./RequiresInput";
import { PathVariableNamesInput } from "./PathVariablesInput";
import { AssetsInput } from "./AssetDefinition";
function PieceDefinition(
  { pieceName, config, setConfig, value: definitions, onChange: setDefinitions }: (
    & InputProps<RosterLockV1Config["engine"]["pieceDefinitions"]>
    & { pieceName: string, config: RosterLockV1Config, setConfig: (v: RosterLockV1Config)=>unknown }
  )
){
  const value = definitions[pieceName];
  const onChange = (v: typeof value) => setDefinitions({ ...definitions, [pieceName]: v });
  return <>
    <PieceTitleInput
      pieceName={pieceName}
      value={config}
      onChange={setConfig}
    />
    <div className="section">
      <SelectionStrategyInput
        value={value.selectionStrategy}
        onChange={v => onChange({ ...value, selectionStrategy: v })}
      />
    </div>
    <div className="section">
      <RequiresInput
        value={value.requires}
        onChange={v => onChange({ ...value, requires: v })}
        pieceName={pieceName}
        engineConfig={config.engine}
      />
    </div>
    <div className="section">
      <PathVariableNamesInput
        value={value.pathVariables}
        onChange={v => onChange({ ...value, pathVariables: v })}
      />
    </div>
    <div className="section">
      <AssetsInput
        value={value.assets}
        onChange={v => onChange({ ...value, assets: v })}
        pathVariables={value.pathVariables}
      />
    </div>
  </>
}

import { TitleInput } from "../../../../../components/TitleInput";
function PieceTitleInput(
  { pieceName, value: config, onChange: setConfig }: (
    & { pieceName: string }
    & InputProps<RosterLockV1Config>
  )
){
  const definitions = config.engine.pieceDefinitions;
  const rosters = config.rosters;
  const selections = config.selection.piece;
  return <TitleInput
    placeholder="Piece Title..."
    originalValue={pieceName}
    validate={name => {
      if(Object.keys(definitions).includes(name)) throw new Error("Name already exists");
    }}
    onSubmit={name => {
      const def = definitions[pieceName];
      const oldDefinitions = { ...definitions };
      delete oldDefinitions[pieceName];

      const roster = rosters[pieceName];
      const oldRosters = { ...rosters };
      delete oldRosters[pieceName];

      const selection = selections[pieceName];
      const oldSelection = { ...selections };
      delete oldSelection[pieceName];

      setConfig({
        ...config,
        engine: { ...config.engine, pieceDefinitions: { ...oldDefinitions, [name]: def } },
        rosters: { ...oldRosters, [name]: roster },
        selection: { ...config.selection, piece: { ...oldSelection, [name]: selection } }
      })
    }}
    onDelete={() => {
      if(config.rosters[pieceName] && config.rosters[pieceName].length > 0){
        if(!window.confirm([
          "A roster exists for this piece definition.",
          "Deleting the piece definition will also delete the roster.",
          "Are you sure you want to delete this piece definition?"
        ].join("\n"))){
          return;
        }
      }
      const { [pieceName]: _, ...oldDefinitions } = definitions;
      const { [pieceName]: __, ...oldRosters } = rosters;
      const { [pieceName]: ___, ...oldSelection } = selections;
      setConfig({
        ...config,
        engine: { ...config.engine, pieceDefinitions: oldDefinitions },
        rosters: oldRosters,
        selection: { ...config.selection, piece: oldSelection }
      })
    }}
  />
}

