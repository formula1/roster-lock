import { RosterLockV1Config } from "@roster-lock/types";
import { CONFIG_ID_PATHS } from "../../paths";
import { ToolTipSpan } from "../../../components/ToolTip";

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
                <li key={piece.version.logic} style={{ marginLeft: "0px", listStyleType: "none" }}>
                  <a href={`#${CONFIG_ID_PATHS.roster.pieceValueId(piece)}`}>
                    <ToolTipSpan
                      tip={[
                        `${piece.humanInfo.name} by ${piece.humanInfo.author}`,
                        `Logic Version: ${piece.version.logic}`,
                        `Media Version: ${piece.version.logic}`,
                      ].join("\n\n")}
                    ><pre>{piece.id}</pre></ToolTipSpan>
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
