import { SelectedPiece } from "@roster-lock/types";
import {
  ScriptPurposeInput,
  PieceUserValidationInput, PieceMergeInput, GlobalValidationInput
} from "@roster-lock/shared";
import { InputProps } from "../../../../../../../utils/react";
import { useEffect, useMemo, useState } from "react";
import { useRosterLock } from "../../../../Contexts/RosterLock";
import { SelectionListInput } from "../../../../components/SelectionListInput";
import { ActiveUserInput, diffUsers, UserListInput } from "../../../../components/UserListInput";

/*
    if(input.type === "piece-user-validation"){
      lua.global.set("pieceType", input.pieceType);
      lua.global.set("selection", input.input);
    } else if(input.type === "piece-merge"){
      lua.global.set("users", input.users);
      lua.global.set("pieceType", input.pieceType);
      lua.global.set("selection", input.input);
    } else if(input.type === "global-validation"){
      lua.global.set("users", input.users);
      lua.global.set("pieceTypes", input.pieceTypes);
      lua.global.set("selection", input.input);
    } else {
*/

export function ScriptPurposeSelectionInput(
  { value, onChange }: InputProps<ScriptPurposeInput>
){
  switch(value.type){
    case "piece-user-validation": {
      return <PieceUserValidationPurposeInput
        value={value} onChange={onChange}
      />
    }
    case "piece-merge": {
      return <PieceMergeSelectionInput
        value={value} onChange={onChange}
      />
    }
    case "global-validation": {
      return <GlobalValidationSelectionInput
        value={value} onChange={onChange}
      />
    }
    default: return <h1>Invalid Script Purpose</h1>
  }
}


function PieceUserValidationPurposeInput(
  { value, onChange }: (
    & InputProps<PieceUserValidationInput>
  )
){
  return (
    <SelectionListInput
      value={value.input}
      onChange={(input)=>(onChange({ ...value, input }))}
      pieceType={value.pieceType}
    />
  )
}

function PieceMergeSelectionInput(
  { value, onChange }: (
    & InputProps<PieceMergeInput>
  )
){
  const [currentUser, setCurrentUser] = useState("");
  useEffect(()=>{
    if(!value.users.includes(currentUser)){
      setCurrentUser(value.users[0])
    }
  }, [value])
  return (
    <div>
      <ActiveUserInput
        value={currentUser}
        onChange={setCurrentUser}
        userList={value.users}
      />
      {currentUser && value.input[currentUser] && (
        <SelectionListInput
          value={value.input[currentUser]}
          onChange={(newSelection)=>(
            onChange({
              ...value, input: {
                ...value.input,
                [currentUser]: newSelection
              },
            })
          )}
          pieceType={value.pieceType}
        />
      )}
    </div>
  )
}

function GlobalValidationSelectionInput(
  { value, onChange }: (
    & InputProps<GlobalValidationInput>
  )
){
  const oldSelection = value.input;
  const { value: lock } = useRosterLock();
  const [currentUser, setCurrentUser] = useState("");
  useEffect(()=>{
    if(!value.users.includes(currentUser)){
      setCurrentUser(value.users[0])
    }
  }, [value])
  const pieceTypes = useMemo(()=>{
    const selectableTypes: Array<string> = [];
    for(const pieceType of Object.keys(lock.engine.pieceDefinitions)){
      const def = lock.engine.pieceDefinitions[pieceType];
      if(def.selectionStrategy === "mandatory") continue;
      if(def.selectionStrategy === "on demand") continue;
      selectableTypes.push(pieceType)
    }
    return selectableTypes;
  }, [lock])
  const [currentPieceType, setCurrentPieceType] = useState(pieceTypes[0] || "")

  const currentDef = lock.engine.pieceDefinitions[currentPieceType];

  const selectConfig = useMemo<InputProps<Array<SelectedPiece>>>(()=>{
    const currentSelect = oldSelection[currentPieceType]
    if(!currentSelect){
      throw new Error("Missing piece type:" + currentPieceType);
    }
    if(currentDef.selectionStrategy === "shared"){
      return {
        value: !Array.isArray(currentSelect) ? [] : currentSelect,
        onChange(newValue){
          onChange({
            ...value,
            input: {
              ...oldSelection,
              [currentPieceType]: newValue
            }
          });
        }
      };
    }
    if(currentDef.selectionStrategy === "personal"){
      return {
        value: Array.isArray(currentSelect) ? [] : currentSelect[currentUser],
        onChange(newValue){
          onChange({
            ...value,
            input: {
              ...oldSelection,
              [currentPieceType]: {
                ...oldSelection[currentPieceType],
                [currentUser]: newValue
              }
            }
          });
        }
      }
    }

    throw new Error("Only supports personal and shared selection types")
  }, [currentPieceType, currentUser, value, onChange])

  return (
    <div>
      <div>
        <span>Piece Type:</span>
        <select value={currentPieceType} onChange={(e)=>(setCurrentPieceType(e.target.value))} >
          {pieceTypes.map((pieceType)=>(
            <option value={pieceType} >{pieceType}</option>
          ))}
        </select>
      </div>
      {currentDef.selectionStrategy === "shared" ? (
        <div>This piece is shared between all users</div>
      ) : (
        <ActiveUserInput
          value={currentUser}
          onChange={setCurrentUser}
          userList={value.users}
        />
      )}
      <SelectionListInput
        pieceType={currentPieceType}
        value={selectConfig.value}
        onChange={selectConfig.onChange}
      />
    </div>
  )
}


