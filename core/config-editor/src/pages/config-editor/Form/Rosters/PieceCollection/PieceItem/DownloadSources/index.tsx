
import { useState } from "react";
import { PieceDefinition, PieceDraftInfo, PieceValue } from "../../types";
import { InputProps, usePromisedMemo } from "../../../../../../../utils/react";
import { ToolTipSpan } from "../../../../../../../components/ToolTip";
import { AsyncValidatingTextInput } from "../../../../../../../components/inputs/AsyncValidatingTextInput";

import { ROSTERLOCK_SIDECAR } from "../../../../../../../globals/side-car";
import { getPluginDir } from "../../../../../../../globals/plugin-dir";

import { getDownloadSourceVersion } from "./getDownloadVersion";
import downloadSourcesTT from "./downloadSourcesTT.md";

export function DownloadSources({ value, onChange, piece, pieceDefinition, draftInfo, onDraftInfoChange }: (
  & InputProps<PieceValue["downloadSources"]>
  & { piece: PieceValue }
  & { pieceDefinition: PieceDefinition }
  & { draftInfo: PieceDraftInfo, onDraftInfoChange: (v: PieceDraftInfo) => void }
)){
  const [testingIndexes, setTestingIndexes] = useState<Set<number>>(new Set());
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
          {value.map((source, index) => {
            const testResult = draftInfo.testedDownloadSources.find(t => t.source === source);
            const isTesting = testingIndexes.has(index);
            const logicOk = !testResult || testResult.version.logic === piece.version.logic;
            const mediaOk = !testResult || testResult.version.media === piece.version.media;
            const docsOk = !testResult || testResult.version.docs === piece.version.docs;

            return (
              <div key={index}>
                <div style={{ display: "flex" }}>
                  <button
                    onClick={() => onChange(value.filter((_, i) => i !== index))}
                  >Remove</button>
                  <button
                    disabled={isTesting}
                    onClick={async () => {
                      setTestingIndexes(prev => new Set(prev).add(index));
                      try {
                        const version = await getDownloadSourceVersion(
                          source, piece.pathVariables, pieceDefinition
                        );
                        onDraftInfoChange({
                          ...draftInfo,
                          testedDownloadSources: [
                            ...draftInfo.testedDownloadSources.filter(t => t.source !== source),
                            { source, testedAt: new Date().toISOString(), version }
                          ]
                        });
                      } finally {
                        setTestingIndexes(prev => {
                          const next = new Set(prev);
                          next.delete(index);
                          return next;
                        });
                      }
                    }}
                  >{isTesting ? "Testing..." : "Test"}</button>
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
                {testResult ? (
                  <div>
                    <div>Last tested: {new Date(testResult.testedAt).toLocaleString()}</div>
                    {!logicOk && <div className="error">Logic mismatch: tested {testResult.version.logic} / lock {piece.version.logic}</div>}
                    {!mediaOk && <div className="error">Media mismatch: tested {testResult.version.media} / lock {piece.version.media}</div>}
                    {!docsOk && <div className="error">Docs mismatch: tested {testResult.version.docs} / lock {piece.version.docs}</div>}
                  </div>
                ) : (
                  <div>Not tested yet</div>
                )}
              </div>
            );
          })}
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
