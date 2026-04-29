import { InputProps, ListItemProps } from "../../../../../../utils/react";
import { PieceDefinition, PieceValue } from "../types";

import { useState } from "react";
import { RosterLockV1Draft } from "@roster-lock/types";

type RosterLockV1Config = RosterLockV1Draft["stagedLock"];

import { ChangeableId } from "./ChangeableId";
import { DisplayVersion } from "./Version";
import { DisplayPathVariables } from "./PathVariables";
import { HumanInfo } from "./HumanInfo";
import { DownloadSources } from "./DownloadSources";
import { RequiredPieces } from "./RequiredPieces";
export function PieceValueItemInput({
  value, onChange,
  index, items, pieceDefinition, config, onDelete
}: (
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
        {displayRaw ? 'Display Clean' : 'Display Raw'}
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
