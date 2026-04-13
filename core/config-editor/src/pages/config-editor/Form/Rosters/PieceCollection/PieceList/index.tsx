import { InputProps, ListItemProps } from "../../../../../../utils/react";
import { PieceDefinition, PieceValue } from "../types";

import { CONFIG_ID_PATHS } from "../../../../paths";
import { useState } from "react";
import { RosterLockV1Draft } from "@roster-lock/types";

type RosterLockV1Config = RosterLockV1Draft["stagedLock"];


export function PieceValueList(
  { value, onChange, pieceType, pieceDefinition, config }: (
    & InputProps<RosterLockV1Config["rosters"][string]>
    & {
      pieceType: string,
      pieceDefinition: PieceDefinition,
      config: RosterLockV1Config
    }
  )
){
  const rosters = config.rosters;

  if(value.length === 0){
    return (
      <div className="section">
        <h2 id={CONFIG_ID_PATHS.roster.pieceTypeId(pieceType)}>{pieceType}</h2>
        <div className="error">No pieces of this type</div>
      </div>
    )
  }

  return (
    <div className="section">
      <h2 id={CONFIG_ID_PATHS.roster.pieceTypeId(pieceType)}>{pieceType}</h2>
      {value.map((piece, index) => (
        <div className="section" key={index} id={CONFIG_ID_PATHS.roster.pieceValueId(piece)}>
          <PieceValueItem
            key={index}
            pieceDefinition={pieceDefinition}
            config={config}


            value={piece}
            onChange={v => onChange(value.map((oldPiece, i) => i !== index ? oldPiece : v))}

            index={index}
            items={value}
            onDelete={() => onChange(value.filter((_, i) => i !== index))}
            
          />
        </div>
      ))}
    </div>
  )
}

import { ChangeableId } from "./ChangeableId";
import { DisplayVersion } from "./Version";
import { DisplayPathVariables } from "./PathVariables";
import { HumanInfo } from "./HumanInfo";
import { DownloadSources } from "./DownloadSources";
import { RequiredPieces } from "./RequiredPieces";
function PieceValueItem({ value, onChange, index, items, pieceDefinition, config, onDelete }: (
  & InputProps<PieceValue>
  & ListItemProps<PieceValue>
  & {
    pieceDefinition: PieceDefinition,
    config: RosterLockV1Config
  }
)){
  const rosters = config.rosters;
  const [displayRaw, setDisplayRaw] = useState(false);
  return (
    <div>
      <h4 style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <div>{value.humanInfo.author}@{value.humanInfo.name}</div>
          <div>{value.version.logic}</div>
        </div>
        <button
          onClick={()=> onDelete()}
        >Remove</button>
      </h4>
      <button onClick={() => setDisplayRaw(!displayRaw)}>
        {displayRaw ? 'Display Clean' : 'Display Raw'} Raw
      </button>
      {displayRaw ? (
        <pre>{JSON.stringify(value, null, 2)}</pre>
      ) : (
        <>
        <ChangeableId
          value={value.id}
          onChange={v => onChange({ ...value, id: v })}
          index={index}
          roster={items}
        />
        <DisplayVersion
          value={value.version}
        />
        <DisplayPathVariables
          value={value.pathVariables}
          pathVariables={pieceDefinition.pathVariables}
        />
        <HumanInfo
          value={value.humanInfo}
          onChange={v => onChange({ ...value, humanInfo: v })}
        />
        <DownloadSources
          value={value.downloadSources}
          onChange={v => onChange({ ...value, downloadSources: v })}
          piece={value}
          pieceDefinition={pieceDefinition}
        />
        <RequiredPieces
          value={value.requiredPieces}
          onChange={v => onChange({ ...value, requiredPieces: v })}
          pieceDefinition={pieceDefinition}
          rosters={rosters}
        />
        </>
      )}
    </div>
  );
}





