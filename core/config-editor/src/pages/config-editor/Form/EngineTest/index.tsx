import { useEffect, useRef, useState } from "react";
import { RosterLockV1Draft, type EngineAssetDefinition } from "@roster-lock/types";
import { cloneJSON } from "@roster-lock/shared";
import {
  DEFAULT_SCAN_UPDATE,
  scanFolder,
  ScanUpdateType,
} from "./utils";
import { ToolTipSpan } from "../../../../components/ToolTip";

import { TestForm, TestFormValue, valueIsReady as testFormValueIsReady } from "./Form";

import { useRosterLock } from "../Contexts/RosterLock";

export function EngineTest(){
  const { value: config } = useRosterLock()
  const [formValue, setFormValue] = useState<TestFormValue>({
    folderPath: "",
    pieceName: "",
    pathVariables: {},
  });

  const currentScan = useRef(-1);
  const [isScanning, setIsScanning] = useState(false);
  const [scanUpdate, setScanUpdate] = useState<ScanUpdateType>(cloneJSON(DEFAULT_SCAN_UPDATE));

  useEffect(() => {
    setScanUpdate(cloneJSON(DEFAULT_SCAN_UPDATE));
    if(!testFormValueIsReady(formValue, config.engine)) return;
    const activeId = Date.now();
    currentScan.current = activeId;
    Promise.resolve().then(async function(){
      setIsScanning(true);
      await scanFolder(
        formValue,
        config.engine,
        (newUpdate)=>{
          if(currentScan.current !== activeId) return;
          setScanUpdate(newUpdate);
        },
      )
      if(currentScan.current !== activeId) return;
      setIsScanning(false);
    })
  }, [formValue]);


  const engineConfig = config.engine;
  const { results, statistics, countViolations } = scanUpdate;

  return <div>
    <h1>Engine Test</h1>

    <TestForm
      value={formValue}
      onChange={v => setFormValue(v)}
      engineConfig={engineConfig}
    />

    {isScanning && <div>Scanning folder...</div>}

    {results.length > 0 && (
      <div>
        <h2>Statistics</h2>
        <table>
          <thead>
            <tr>
              <th>Classification</th>
              <th>Number of Files</th>
              <th>Total Size</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Total</td>
              <td>{statistics.total.files}</td>
              <td>{formatBytes(statistics.total.bytes)}</td>
            </tr>
            <tr>
              <td>Logic</td>
              <td>{statistics.logic.files}</td>
              <td>{formatBytes(statistics.logic.bytes)}</td>
            </tr>
            <tr>
              <td>Media</td>
              <td>{statistics.media.files}</td>
              <td>{formatBytes(statistics.media.bytes)}</td>
            </tr>
            <tr>
              <td>Doc</td>
              <td>{statistics.doc.files}</td>
              <td>{formatBytes(statistics.doc.bytes)}</td>
            </tr>
            <tr>
              <td>Unmatched</td>
              <td>{statistics.unmatched.files}</td>
              <td>{formatBytes(statistics.unmatched.bytes)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    )}

    {results.length > 0 && (
      <div>
        <h2>File Results</h2>
        <table>
          <thead>
            <tr>
              <th>File Path</th>
              <th>Matched Asset</th>
              <th>Classification</th>
              <th>Count Violations</th>
              <th>Total Matched Assets</th>
              <th>File Size</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result, index) => {
              const matchedAsset = result.matchedAssets[0];
              const assetCountViolations = (
                !matchedAsset ? "None" :
                countViolations[matchedAsset.name].violation || "None"
              );
              return <tr key={index}>
                <td>{result.relativePath}</td>
                <td>{!matchedAsset ? 'None' : matchedAsset.name}</td>
                <td>{!matchedAsset ? 'N/A' : matchedAsset.classification}</td>
                <td>{assetCountViolations}</td>
                <td>
                  {!matchedAsset ? 0 : (
                    <ToolTipSpan
                      tip={assetsToMD(result.matchedAssets)}
                    >{result.matchedAssets.length}</ToolTipSpan>
                  )}
                </td>
                <td>{formatBytes(result.fileSize)}</td>
              </tr>
            })}
          </tbody>
        </table>
      </div>
    )}
  </div>
}

function assetsToMD(assets: EngineAssetDefinition[]){
  return `All Matched Assets:\n${assets.map((asset, i)=>(
    `- ${asset.name} - ${asset.classification}${i === 0 ? ' (Active Asset)' : ''}`
  )).join('\n')}`;
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

