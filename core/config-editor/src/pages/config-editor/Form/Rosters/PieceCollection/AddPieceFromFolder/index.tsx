import { nativeWindow } from "../../../../../../tauri/window";
import { PieceDefinition, PieceValue, PieceDraftInfo } from "../types";
import { useEffect, useState } from "react";

import { PieceDefinitionInput } from "./PieceDefinitionInput";
import { PathVariableValuesInput } from "./PathVariablesInput";
import { AssetsAndFiles, AssetsAndFilesValue } from "./AssetsAndFiles";
import { CreatePiece } from "./CreatePiece";
import { RosterLockV1Config } from "@roster-lock/types";

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
  const [pieceDefinitionKey, setPieceDefintionKey] = useState<string>("");
  const [currentFolder, setCurrentFolder] = useState<null | string>(null);
  const [pathVariables, setPathVariables] = useState<null | Record<string, string>>(null);
  const [assetsAndFiles, setAssetsAndFiles] = useState<null | AssetsAndFilesValue>(null);


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
            onClick={async () => {
            try {
              const result = await nativeWindow.showOpenDialog({
                title: 'Select Piece Folder',
                properties: ['openDirectory'],
                filters: [],
              });

              if(result.canceled) return;
              if(result.filePaths.length === 0) return;

              const folderPath = result.filePaths[0];
              setCurrentFolder(folderPath);
            } catch (error) {
              console.error('Error opening file:', error);
            }
          }}
          >Load Piece From Folder</button>
        </div>
        {currentFolder && <div>Selected: {currentFolder}</div>}
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
      {pieceDefinition && pathVariables && currentFolder && (
        <AssetsAndFiles
          folderPath={currentFolder}
          pathVariables={pathVariables}
          pieceDefinition={pieceDefinition}
          onChange={setAssetsAndFiles}
        />
      )}
      {pieceDefinition && pathVariables && currentFolder && assetsAndFiles && (
        <CreatePiece
          folderPath={currentFolder}
          fileErrors={assetsAndFiles.errors}
          filesWithAssets={assetsAndFiles.filesWithAssets}
          pathVariables={pathVariables}
          pieceDefinition={pieceDefinition}
          onSubmit={(piece)=>{
            onSubmit({
              pieceDefinitionKey,
              piece,
              draftInfo: { referenceFolder: currentFolder, testedDownloadSources: [] }
            })
          }}
        />
      )}
    </div>
  )
}

function resetPathVariables(pieceDefinition: PieceDefinition){
  const pathVariables: Record<string, string> = {};
  for(const variable of pieceDefinition.pathVariables){
    pathVariables[variable] = "";
  }
  return pathVariables;
}

