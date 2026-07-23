import { InputProps } from "../../../../utils/react";
import { RosterLockV1Config, SelectedPiece } from "@roster-lock/types";
import { useRosterLock } from "../Contexts/RosterLock";
import { useState } from "react";

const PIECE_ID = Symbol("pieceSymbol");

type RosterPiece = RosterLockV1Config["rosters"][string][number];
type PieceRef = SelectedPiece & { [PIECE_ID]?: string };

export function SelectionListInput(
  { value, onChange, pieceType }: (
    & InputProps<Array<PieceRef>>
    & { pieceType: string }
  )
){
  const { value: lock } = useRosterLock();
  const items = lock.rosters[pieceType];
  if(!items){
    return <h4 className="error">Roster not set for {pieceType}</h4>
  }
  if(items.length == 0){
    return <h4>No pieces available for {pieceType}</h4>
  }

  for(const pieceRef of value){
    if(!pieceRef[PIECE_ID]) pieceRef[PIECE_ID] = crypto.randomUUID();
  }

  return (
    <>
      <SelectionForm
        pieceType={pieceType}
        onSubmit={(newValue)=>{
          onChange([...value, newValue])
        }}
      />
      <ul>
        {value.map((pieceRef, activeIndex)=>{
          const piece = items.find((item)=>(item.id === pieceRef.id));
          if(!piece) return <li>Missing Piece: {pieceRef.id}</li>
          return (
            <li key={pieceRef[PIECE_ID]}>
              <div>
                <span>Id: {pieceRef.id}</span>
                <button
                  onClick={()=>(
                    onChange(value.filter((v, mapIndex)=>(activeIndex !== mapIndex)))
                  )}
                >Remove</button>
              </div>
              {Object.entries(pieceRef.required).map(([requiredPieceType, requiredPieces])=>(
                <PieceRefItemRequiredInput
                  key={requiredPieceType}
                  value={requiredPieces}
                  onChange={(requiredPieces)=>{
                    onChange(value.map((oldItem, mapIndex)=>(
                      activeIndex !== mapIndex ? oldItem : {
                        ...pieceRef,
                        required: { ...pieceRef.required, [requiredPieceType]: requiredPieces }
                      }
                    )))
                  }}
                  requiredPieceType={requiredPieceType}
                  piece={piece}
                />
              ))}
            </li>
          );
        })}
      </ul>
    </>
  )
}

function SelectionForm(
  { onSubmit, pieceType, }: {
    onSubmit: (newPiece: PieceRef)=>any
    pieceType: string,
  }
){
  const { value: lock } = useRosterLock();
  const roster = lock.rosters[pieceType];
  if(!roster) throw new Error(`Missing roster for ${pieceType}`);
  const [itemId, setItemId] = useState(roster[0]?.id || "");

  if(roster.length === 0){
    return <h4>No Items Available</h4>
  }

  return (
    <div>
      <select onChange={(e)=>{setItemId(e.target.value)}} value={itemId} >
        {roster.map((item)=>(
          <option key={item.id} value={item.id} >{item.id}</option>
        ))}
      </select>
      <button
        onClick={()=>{
          onSubmit(fillOutItem(lock, pieceType, itemId));
        }}
      >Add Piece</button>
    </div>
  );
}

function fillOutItem(rosterLock: RosterLockV1Config, pieceType: string, pieceId: string): PieceRef {
  const definition = rosterLock.engine.pieceDefinitions[pieceType];
  if(!definition) throw new Error(`Missing piece definition for ${pieceType}`);
  const roster = rosterLock.rosters[pieceType];
  if(!roster) throw new Error(`Missing roster for ${pieceType}`);
  const item = roster.find((item)=>(item.id === pieceId))
  if(!item) throw new Error(`Missing piece for ${pieceType} with id ${pieceId}`)
  const piece: PieceRef = {
    id: pieceId,
    required: {}
  };

  for(const required of definition.requires){
    piece.required[required] = {
      mandatory: [],
      selectable: [],
    }
    for(const expectedId of item.requiredPieces[required].expected){
      piece.required[required].mandatory.push(
        fillOutItem(rosterLock, required, expectedId)
      )
    }
  }
  return piece;
}


function MandatoryPieceInput(
  { value, onChange, pieceType }: (
    & InputProps<Array<PieceRef>>
    & { pieceType: string }
  )
){
  const { value: lock } = useRosterLock();
  const items = lock.rosters[pieceType]
  if(!items){
    return <h4 className="error">Roster not set for {pieceType}</h4>
  }
  if(items.length == 0){
    return <h4>No pieces available for {pieceType}</h4>
  }
  for(const pieceRef of value){
    if(!pieceRef[PIECE_ID]) pieceRef[PIECE_ID] = crypto.randomUUID();
  }
  return (
    <ul>
      {value.map((pieceRef, activeIndex)=>{
        const piece = items.find((item)=>(item.id === pieceRef.id));
        if(!piece) return <li>Missing Piece: {pieceRef.id}</li>
        return (
          <li key={pieceRef[PIECE_ID]}>
            <div>
              <span>Id: {pieceRef.id}</span>
            </div>
            {Object.entries(pieceRef.required).map(([requiredPieceType, requiredPieces])=>(
              <PieceRefItemRequiredInput
                key={requiredPieceType}
                value={requiredPieces}
                onChange={(requiredPieces)=>{
                  onChange(value.map((oldItem, mapIndex)=>(
                    activeIndex !== mapIndex ? oldItem : {
                      ...pieceRef,
                      required: { ...pieceRef.required, [requiredPieceType]: requiredPieces }
                    }
                  )))
                }}
                requiredPieceType={requiredPieceType}
                piece={piece}
              />
            ))}
          </li>
        );
      })}
    </ul>
  );
}

function PieceRefItemRequiredInput(
  { value, onChange, piece, requiredPieceType }: (
    & InputProps<PieceRef["required"][string]>
    & {
      piece: RosterPiece,
      requiredPieceType: string
    }
  )
){
  const hasMandatory = piece.requiredPieces[requiredPieceType].expected.length > 0;
  const hasSelectable = piece.requiredPieces[requiredPieceType].selectable
  if(!hasMandatory && !hasSelectable) return null;
  return (
    <div>
      <div>Requires: {requiredPieceType}</div>
      {hasMandatory && (
        <div>
          <h4>Mandatory</h4>
          <MandatoryPieceInput
            pieceType={requiredPieceType}
            value={value.mandatory}
            onChange={(mandatory)=>{
              onChange({ ...value, mandatory })
            }}
          />
        </div>
      )}
      {hasSelectable && (
        <div>
          <h4>Optional</h4>
          <SelectionListInput
            pieceType={requiredPieceType}
            value={value.selectable}
            onChange={(selectable)=>{
              onChange({ ...value, selectable })
            }}
          />
        </div>
      )}
    </div>
  )
}