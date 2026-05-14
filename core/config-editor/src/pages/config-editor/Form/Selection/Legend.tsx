import { RosterLockV1Config } from "@roster-lock/types";

import { RosterLockPaths } from "../../paths";
import { replaceParams } from "../../../../utils/router";
import { Link, useParams } from "react-router";

export function SelectionLegend({ config }: { config: RosterLockV1Config }){
  const params = useParams();
  const pieces = Object.entries(config.engine.pieceDefinitions);
  if(pieces.length === 0) return null;
  return (
  <div className="section" style={{ textAlign: "left" }}>
    <h2>Legend</h2>
    <div className="alternate-list">
      <h4 className="section" >
        <Link
          to={replaceParams(RosterLockPaths.Selection.ScriptDocs, params)}
        >Script Docs</Link>
      </h4>
      <h4 className="section" >
        <Link
          to={replaceParams(RosterLockPaths.Selection.ScriptDictionary.INDEX, params)}
        >Script Dictionary</Link>
      </h4>
      <h4 className="section" >
        <Link
          to={replaceParams(RosterLockPaths.Selection.GlobalValidation, params)}
        >Global Validation</Link>
      </h4>
      <div className="section" >
        <h4>Piece Validation</h4>
        {pieces.map(([pieceType])=>(
          <div key={pieceType}>
            <Link
              to={replaceParams(
                RosterLockPaths.Selection.PieceSelection,
                { filePath: params.filePath, pieceType }
              )}
            ><code>{pieceType}</code></Link>
          </div>
        ))}
      </div>
    </div>
  </div>
  );
}

