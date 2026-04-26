

import { validatePathVariableValue, collectAssetFileErrors, getAssetsOfFiles } from "@roster-lock/shared";
import { useState } from "react";
import { useRunnable, RunnableState } from "../../../../../../../utils/react";
import { PieceDefinition, PieceValue } from "../../types";

import "./styles.css";

import { createPieceValue } from "./createPieceValue";

export function CreatePiece(
  {
    folderPath,
    fileErrors, filesWithAssets,
    pathVariables, pieceDefinition,
    onSubmit,
  }: {
    folderPath: string,
    fileErrors: ReturnType<typeof collectAssetFileErrors>,
    filesWithAssets: Awaited<ReturnType<typeof getAssetsOfFiles>>["filesWithAssets"],
    pieceDefinition: PieceDefinition,
    pathVariables: Record<string, string>,
    onSubmit: (v: PieceValue)=>unknown,
  }
){
  const [progressMap, setProgressMap] = useState<Record<string, { current: number, total: number }>>({});
  const status = useRunnable(async ()=>{
    const emptyProgressMap: Record<string, { current: number, total: number }> = {};
    for(const [file, { assets }] of filesWithAssets.entries()){
      emptyProgressMap[file] = { current: 0, total: -1 };
    }
    setProgressMap(emptyProgressMap)
    return await createPieceValue({
      folderPath, pathVariables, filesWithAssets, pieceDefinition,
      progressListener: (progress)=>{
        setProgressMap((prev)=>({
          ...prev,
          [progress.file]: progress,
        }));
      },
    })
  });

  const pathVariableErrors = validatePathVariables(pieceDefinition, pathVariables);
  if(fileErrors.length > 0 || pathVariableErrors.length > 0){
    return (
      <div className="create-piece">
        <h3 className="error">Cannot Create Piece</h3>
        {fileErrors.length > 0 && (
          <div className="section">
            <h4>File Errors</h4>
            <p>The following file related errors must be resolved before a piece can be created.</p>
            <ul>
              {fileErrors.map((error, index) => (
                <li key={index} className="section">
                  <div>{error.type === "asset" ? "Asset" : "File"}: {error.id}</div>
                  <div>{error.message}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
        {pathVariableErrors.length > 0 && (
          <div className="section">
            <h4>Path Variable Errors</h4>
            <p>The following path variable errors must be resolved before a piece can be created.</p>
            <ul>
              {pathVariableErrors.map((error, index) => (
                <li key={index} className="section">
                  <div>Variable: {error.id}</div>
                  <div>{error.message}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return <>
    <div className="create-piece">
      <h3><button onClick={()=>(status.run())}>Prepare Piece</button></h3>
    </div>
    {status.state === RunnableState.PENDING ? (
      <div className="create-piece">
        <h3>Creating Piece...</h3>
        <ProgressTable progressMap={progressMap} />
      </div>
    ) : status.state === RunnableState.FAILED ? (
      <div className="create-piece">
        <h3>Failed</h3>
        <ProgressTable progressMap={progressMap} />
        <pre>{JSON.stringify(status.error, null, 2)}</pre>
      </div>
    ) : status.state === RunnableState.SUCCESS ? (
      <div className="create-piece">
        <h3>Success</h3>
        <ProgressTable progressMap={progressMap} />
        <pre>{JSON.stringify(status.value, null, 2)}</pre>
        <button onClick={() => onSubmit(status.value)}>Add Piece to Roster</button>
      </div>
    ) : null}
  </>
}

function ProgressTable(
  { progressMap }: {
    progressMap: Record<string, { current: number, total: number }>
  }
){
  return (
    <table>
      <thead>
        <tr>
          <th>File</th>
          <th>Bytes Done</th>
          <th>Percent Done</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(progressMap).map(([file, { current, total }], index) => (
          <tr
            key={index}
            className={"progress " + (total === -1 ? "unstarted" :current < total ? "active" : "done")}
          >
            <td>{file}</td>
            <td>{current} / {total}</td>
            <td>{(current / total * 100).toFixed(2)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}



function validatePathVariables(
  pieceDefinition: PieceDefinition,
  pathVariableValues: Record<string, string>
){
  const errors: Array<{ id: string, message: string }> = [];
  for(const variableName of pieceDefinition.pathVariables){
    const variableValue = pathVariableValues[variableName];
    if(!variableValue){
      errors.push({ id: variableName, message: `Missing value for path variable` });
      continue;
    }
    try {
      validatePathVariableValue(variableValue);
    }catch(e){
      errors.push({ id: variableName, message: (e as Error).message });
    }
  }
  return errors;
}