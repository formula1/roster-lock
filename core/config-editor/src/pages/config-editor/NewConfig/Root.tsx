
import { useNewConfig } from "./data/Config";
import { useSaveFile } from "./data/saveFile";

export function NewConfigRoot(){
  const { value, onChange } = useNewConfig();
  const saveFile = useSaveFile();

  const config = value.stagedLock;
  return (
    <>
      <h1><button onClick={saveFile}>Save File</button></h1>
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
