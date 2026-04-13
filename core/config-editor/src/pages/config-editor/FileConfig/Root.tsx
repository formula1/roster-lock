
import { useCurrentRosterLockFile } from "./data/CurrentFile";

export function FileConfigRoot(){
  const currentFile = useCurrentRosterLockFile();

  if(!currentFile.activeFile){
    return <div>No active file</div>
  }

  if(currentFile.state === "loading"){
    return <div>Loading...</div>
  }

  if(currentFile.state === "failed"){
    return <div>Failed</div>
  }

  const config = currentFile.value.stagedLock;

  return (
    <>
      <h1><button onClick={()=>(currentFile.save())}>Save File</button></h1>
      <div>
        <div>Engine: {config.engine.name} - {config.engine.version}</div>
        <table>
          <thead>
            <tr>
              <th>Piece Type</th>
              <th>Selection Strategy</th>
              <th>Requires</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(config.rosters).map(([pieceType, pieceValues])=>{
              const definition = config.engine.pieceDefinitions[pieceType];
              return (
                <tr key={pieceType}>
                  <td>{pieceType}</td>
                  <td>{definition.selectionStrategy}</td>
                  <td>{definition.requires.join(", ")}</td>
                  <td>{pieceValues.length}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
