
import { useParams } from "react-router";

import { PieceValueItemInput } from "./Input";
import { useRosterLock } from "../../../Contexts/RosterLock";
export { PieceValueItemInput };


export function PieceValueItemPage(){
  const { value: rosterLock, onChange } = useRosterLock();
  const { pieceType = "", pieceId } = useParams()

  const pieceDefinition = rosterLock.engine.pieceDefinitions[pieceType]

  if(!pieceDefinition){
    return <h1>Missing pieceType {pieceType}</h1>
  }

  const roster = rosterLock.rosters[pieceType]
  if(!roster){
    return <h1>Roster not set</h1>
  }

  const pieceIndex = roster.findIndex((piece)=>(
    piece.version.logic === pieceId
  ))

  const piece = roster[pieceIndex];

  if(!piece){
    return <h1>Non extisting piece</h1>
  }


  return (
    <PieceValueItemInput
      pieceDefinition={pieceDefinition}
      config={rosterLock}


      value={piece}
      onChange={(v)=>{
        onChange((config)=>{
          return {
            ...config,
            rosters: {
              ...config.rosters,
              [pieceType]: (config.rosters[pieceType] || []).map(
                (oldPiece)=>(oldPiece.version.logic !== pieceId ? oldPiece : v)
              )
            }
          }
        })
      }}

      index={pieceIndex}
      items={roster}
      onDelete={() =>{
        onChange((config)=>{
          return {
            ...config,
            rosters: {
              ...config.rosters,
              [pieceType]: (config.rosters[pieceType] || []).filter(
                (oldPiece)=>(oldPiece.version.logic !== pieceId)
              )
            }
          }
        })
      }}
    />
  )
  
}
