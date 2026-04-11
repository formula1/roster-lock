import { RosterLockV1Config } from "@roster-lock/types";
import { CONFIG_ID_PATHS } from "../../paths";

export function PieceRosterLegend(
  { rosters }: { rosters: RosterLockV1Config["rosters"] }
){
  return (
    <div className="section" style={{ textAlign: "left" }}>
      <h2>Legend</h2>
      <div className="alternate-list">
        {Object.entries(rosters).map(([pieceName, pieceValues]) => (
          <div key={pieceName} className="section">
            <h4><a href={`#${CONFIG_ID_PATHS.roster.pieceTypeId(pieceName)}`}>{pieceName}</a></h4>
            <ul>
              {pieceValues.map((piece) => (
                <li key={piece.version.logic}>
                  <a href={`#${CONFIG_ID_PATHS.roster.pieceValueId(piece)}`}>
                    <div><pre>{piece.id}</pre></div>
                    <div>{piece.humanInfo.name} by {piece.humanInfo.author}</div>
                    <div>{piece.version.logic}/{piece.version.media}</div>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
