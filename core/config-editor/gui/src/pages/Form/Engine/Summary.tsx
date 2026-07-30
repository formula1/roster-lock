
import { RosterLockV1Config } from "@roster-lock/types";
import { CONFIG_ID_PATHS } from "../../paths";

export function EngineSummary({ value }: { value: RosterLockV1Config["engine"] }){
  return <div>
    <div>{value.name}: {value.version}</div>
    <div>
      <h4>Pieces</h4>
      <ul>
        {Object.keys(value.pieceDefinitions).map((pieceName) => (
          <li key={pieceName}>
            <a href={`#${CONFIG_ID_PATHS.roster.pieceTypeId(pieceName)}`}>{pieceName}</a>
          </li>
        ))}
      </ul>
    </div>
  </div>;
}
