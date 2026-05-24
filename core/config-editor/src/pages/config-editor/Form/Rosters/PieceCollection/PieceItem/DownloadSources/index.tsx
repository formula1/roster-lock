
import { PieceDefinition, PieceValue } from "../../types";
import { InputProps, usePromisedMemo } from "../../../../../../../utils/react";
import { ToolTipSpan } from "../../../../../../../components/ToolTip";
import { AsyncValidatingTextInput } from "../../../../../../../components/inputs/AsyncValidatingTextInput";

import { ROSTERLOCK_SIDECAR } from "../../../../../../../globals/side-car";
import { getPluginDir } from "../../../../../../../globals/plugin-dir";

import { getDownloadSourceVersion } from "./getDownloadVersion";
import downloadSourcesTT from "./downloadSourcesTT.md";

export function DownloadSources({ value, onChange, piece, pieceDefinition }: (
  & InputProps<PieceValue["downloadSources"]>
  & { piece: PieceValue }
  & { pieceDefinition: PieceDefinition }
)){
  const pluginText = useDownloadPluginsText();
  return (
    <div className="section">
      <div>
        <ToolTipSpan
          tip={downloadSourcesTT + (pluginText.status === "success" ? pluginText.value : "")}
        >Download Sources</ToolTipSpan>
      </div>
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
              <AsyncValidatingTextInput
                style={{ flexGrow: 1 }}
                value={source}
                onChange={v => onChange(value.map((oldSource, i) => i !== index ? oldSource : v))}
                validate={async (url: string)=>{
                  const protocols = await ROSTERLOCK_SIDECAR.matchDownloadProtocols(
                    await getPluginDir(), url
                  )
                  if(protocols.length === 0){
                    throw new Error("No matching protocols")
                  }
                }}
              />
            </div>
            </>
          ))}
        </div>
      )}
    </div>
  )
}


function useDownloadPluginsText(){
  return usePromisedMemo(async ()=>{
    const plugins = await ROSTERLOCK_SIDECAR.getDownloadPlugins(
      await getPluginDir()
    );

    let downloadSourcesTT = ""
    downloadSourcesTT += "\n\n## Available Protocols";
    downloadSourcesTT += "\n\n" + (
      Object.values(plugins.protocol)
      .map((v) => `- ${v.name}`)
      .join('\n')
    );
  }, [])
}

