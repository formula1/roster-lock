import { useHost, FOLDER_ACCESS_HINT } from "../../../../../globals/Host";
import { usePlugins } from "../../../../../globals/agent";
import { PieceDefinition, PieceValue, PieceDraftInfo } from "../types";
import { useEffect, useState } from "react";

import { PieceDefinitionInput } from "./PieceDefinitionInput";
import { PathVariableValuesInput } from "./PathVariablesInput";
import { AssetsAndFiles, AssetsAndFilesValue } from "./AssetsAndFiles";
import { CreatePiece } from "./CreatePiece";
import { RosterLockV1Config } from "@roster-lock/types";
import { PieceSource, downloadSessionSource } from "./source";

export function AddPieceFromFolder(
  { onSubmit, rosterLock }: {
    onSubmit: (v: {
      pieceDefinitionKey: string
      piece: PieceValue,
      draftInfo: PieceDraftInfo,
    })=>unknown,
    rosterLock: RosterLockV1Config
  }
){
  const host = useHost();
  const plugins = usePlugins();
  const [pieceDefinitionKey, setPieceDefintionKey] = useState<string>("");
  const [source, setSourceState] = useState<null | PieceSource>(null);
  const [sourceError, setSourceError] = useState<null | string>(null);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [pathVariables, setPathVariables] = useState<null | Record<string, string>>(null);
  const [assetsAndFiles, setAssetsAndFiles] = useState<null | AssetsAndFilesValue>(null);

  const setSource = (next: null | PieceSource) => {
    setSourceState((prev)=>{
      if(prev && prev !== next) prev.close?.();
      return next;
    });
    setAssetsAndFiles(null);
  };

  const pieceDefinition = rosterLock.engine.pieceDefinitions[pieceDefinitionKey]

  useEffect(()=>{
    if(!pieceDefinition) return;
    setPathVariables(resetPathVariables(pieceDefinition))
  }, [pieceDefinition])

  if(Object.values(rosterLock.engine.pieceDefinitions).length === 0){
    return <>
      <h1 className="error" >No Ddefinitions set in engine</h1>
    </>
  }

  return (
    <div className="section" >
      <div className="section">
        <PieceDefinitionInput
          value={pieceDefinitionKey}
          onChange={setPieceDefintionKey}
          rosterLock={rosterLock}
        />
        <div>
          <button
            disabled={!host.walkDir}
            title={!host.walkDir ? FOLDER_ACCESS_HINT : undefined}
            onClick={async () => {
            if(!host.walkDir) return;
            try {
              setSourceError(null);
              const walked = await host.walkDir(undefined, { title: 'Select Piece Folder' });
              if(!walked) return;
              setSource({
                label: walked.folderToken,
                folderToken: walked.folderToken,
                entries: walked.entries,
              });
            } catch (error) {
              setSourceError(errorToString(error));
            }
          }}
          >Load Piece From Folder</button>
        </div>
        <div>
          <input
            type="text"
            placeholder="Download source URL"
            value={downloadUrl}
            onChange={(e)=>setDownloadUrl(e.target.value)}
          />
          <button
            disabled={!plugins || !downloadUrl || downloading}
            title={!plugins ? "Connect a match-agent to load from a download source" : undefined}
            onClick={async ()=>{
              if(!plugins) return;
              setDownloading(true);
              setSourceError(null);
              try {
                const session = await plugins.createDownloadSession(downloadUrl);
                setSource(downloadSessionSource(plugins, downloadUrl, session));
              } catch(error){
                setSourceError(errorToString(error));
              } finally {
                setDownloading(false);
              }
            }}
          >{downloading ? "Downloading..." : "Load Piece From Download Source"}</button>
        </div>
        {sourceError && <div className="error">{sourceError}</div>}
        {source && <div>{source.label}</div>}
        {source && <div><button onClick={()=>(setSource(null))} >Clear Source</button></div>}
      </div>
      {pieceDefinition && pathVariables && pieceDefinition.pathVariables.length > 0 && (
        <div className="section">
          <PathVariableValuesInput
            value={pathVariables}
            onChange={setPathVariables}
            pathVariables={pieceDefinition.pathVariables}
          />
        </div>
      )}
      {pieceDefinition && pathVariables && source && (
        <AssetsAndFiles
          source={source}
          pathVariables={pathVariables}
          pieceDefinition={pieceDefinition}
          onChange={setAssetsAndFiles}
        />
      )}
      {pieceDefinition && pathVariables && source && assetsAndFiles && (
        <CreatePiece
          source={source}
          fileErrors={assetsAndFiles.errors}
          filesWithAssets={assetsAndFiles.filesWithAssets}
          pathVariables={pathVariables}
          pieceDefinition={pieceDefinition}
          onSubmit={async (piece)=>{
            // A downloaded piece just proved its source works - record it as
            // both a download source and a tested one.
            if(source.downloadSource && !piece.downloadSources.includes(source.downloadSource)){
              piece = { ...piece, downloadSources: [...piece.downloadSources, source.downloadSource] };
            }
            await onSubmit({
              pieceDefinitionKey,
              piece,
              draftInfo: {
                ...(source.folderToken ? { referenceFolder: source.folderToken } : {}),
                testedDownloadSources: source.downloadSource ? [{
                  source: source.downloadSource,
                  testedAt: Date.now(),
                  version: piece.version,
                }] : [],
              }
            })
            setPieceDefintionKey("");
            setSource(null);
            setPathVariables(null)
          }}
        />
      )}
    </div>
  )
}

function errorToString(error: unknown){
  return error instanceof Error ? error.message : String(error);
}

function resetPathVariables(pieceDefinition: PieceDefinition){
  const pathVariables: Record<string, string> = {};
  for(const variable of pieceDefinition.pathVariables){
    pathVariables[variable] = "";
  }
  return pathVariables;
}
