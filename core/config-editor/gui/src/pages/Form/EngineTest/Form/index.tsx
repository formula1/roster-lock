import { RosterLockV1Config } from "@roster-lock/types";
import { validatePathVariableValue } from "@roster-lock/shared";
import { InputProps } from "../../../../utils/react";
import { FolderInput } from "./FolderInput";
import { PieceSelect } from "./PieceSelect";
import { PathVariableValuesInput } from "../../Rosters/PieceCollection/AddPieceFromFolder/PathVariablesInput";

type RosterLockEngineConfig = RosterLockV1Config["engine"];

export type TestFormValue = {
  folderPath: string;
  pieceName: string;
  pathVariables: Record<string, string>;
}

export function valueIsReady(value: TestFormValue, engineConfig: RosterLockEngineConfig){
  if(!value.folderPath) return false;
  if(!value.pieceName) return false;
  for(const variableName of engineConfig.pieceDefinitions[value.pieceName].pathVariables){
    const variableValue = value.pathVariables[variableName];
    if(!variableValue) return false;
    try {
      validatePathVariableValue(variableValue);
    }catch(e){
      return false;
    }
  }
  return true;
}

export function TestForm(
  { value, onChange, engineConfig }: (
    & InputProps<TestFormValue>
    & { engineConfig: RosterLockEngineConfig }
  )
) {

  const pieceDef = value.pieceName && engineConfig.pieceDefinitions[value.pieceName];

  return (
    <>
    <div className="section" >
      <FolderInput
        value={value.folderPath}
        onChange={v => onChange({ ...value, folderPath: v })}
      />
    </div>

    <div className="section">
      <PieceSelect
        value={value.pieceName || ""}
        onChange={v => onChange({ ...value, pieceName: v })}
        engineConfig={engineConfig}
      />
    </div>

    {pieceDef && pieceDef.pathVariables.length > 0 && (
      <div className="section">
        <PathVariableValuesInput
          value={value.pathVariables}
          onChange={(v)=> onChange({ ...value, pathVariables: v })}
          pathVariables={pieceDef.pathVariables}
        />
      </div>
    )}
    </>
  )
}
