import { RosterLockV1Config } from "@roster-lock/types";

import { CONFIG_ID_PATHS } from "../../paths";

export function EngineLegend({ config }: { config: RosterLockV1Config }){
  const pieces = Object.entries(config.engine.pieceDefinitions);
  if(pieces.length === 0) return null;
  return (
  <div className="section" style={{ textAlign: "left" }}>
    <h2>Legend</h2>
    <div className="alternate-list">
    {pieces.map(([pieceName, definition]) => (
      <div key={pieceName} className="section">
        <h4><a href={`#${CONFIG_ID_PATHS.engine.pieceId(pieceName)}`}>{pieceName}</a></h4>
        {definition.assets.length > 0 && (
          <ul>
            {definition.assets.map((asset) => (
              <li key={asset.name}>
                <a href={`#${CONFIG_ID_PATHS.engine.assetId(asset)}`}>{asset.name}</a>
              </li>
            ))}
          </ul>
        )}
      </div>
    ))}
    </div>
  </div>
  );
}

