
import { PieceDefinition, PieceValue } from "../../types";
import { InputProps } from "../../../../../../../utils/react";
import { ToolTipSpan } from "../../../../../../../components/ToolTip";
import { ValidatingTextInput } from "../../../../../../../components/inputs/ValidatingTextInput";


import { getDownloadSourceVersion } from "./getDownloadVersion";
import {
  DOWNLOADABLE_SOURCE_PROTOCOLS,
  validateDownloadableSource
} from "@roster-lock/shared";
import downloadSourcesTTRAW from "./downloadSourcesTT.md";
let downloadSourcesTT = downloadSourcesTTRAW;


downloadSourcesTT += "\n\n## Available Protocols";
downloadSourcesTT += "\n\n" + (
  Object.values(DOWNLOADABLE_SOURCE_PROTOCOLS)
  .map((v) => `- ${v.protocol}`)
  .join('\n')
);

export function DownloadSources({ value, onChange, piece, pieceDefinition }: (
  & InputProps<PieceValue["downloadSources"]>
  & { piece: PieceValue }
  & { pieceDefinition: PieceDefinition }
)){
  return (
    <div className="section">
      <div><ToolTipSpan tip={downloadSourcesTT}>Download Sources</ToolTipSpan></div>
      {value.length === 0 ? <div className="error">At least one source is required</div> : (
        <div>
          {value.map((source, index) => (
            <>
            <div key={index} style={{ display: "flex" }}>
              <button
                onClick={() => onChange(value.filter((_, i) => i !== index))}
              >Remove</button>
              <button
                onClick={async () =>{
                  const version = await getDownloadSourceVersion(
                    source, piece.pathVariables, pieceDefinition
                  )
                  if(version.logic !== piece.version.logic){
                    alert("Logic Version Mismatch");
                  }
                  if(version.media !== piece.version.media){
                    alert("Media Version Mismatch");
                  }
                  if(version.docs !== piece.version.docs){
                    alert("Docs Version Mismatch");
                  }
                }}
              >Test</button>
              <ValidatingTextInput
                style={{ flexGrow: 1 }}
                value={source}
                onChange={v => onChange(value.map((oldSource, i) => i !== index ? oldSource : v))}
                validate={validateDownloadableSource}
              />
            </div>
            </>
          ))}
        </div>
      )}
    </div>
  )
}


