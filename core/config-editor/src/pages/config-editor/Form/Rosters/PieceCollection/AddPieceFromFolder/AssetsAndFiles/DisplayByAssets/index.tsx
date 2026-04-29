import { useMemo, useState } from "react"
import { PieceDefinition } from "../../../types"
import { getAssetsOfFiles, isValidAssetFileCount } from "@roster-lock/shared";

import { ToolTipSpan } from "../../../../../../../../components/ToolTip";
import missingFilesTT from "./missingFilesTT.md";
import invalidCountTT from "./invalidCountTT.md";

export function DisplayByAssets(
  { assets, files }: {
    assets: Awaited<ReturnType<typeof getAssetsOfFiles>>["assetsWithFiles"],
    files: Awaited<ReturnType<typeof getAssetsOfFiles>>["filesWithAssets"]
  }
){

  const [filters, setFilters] = useState({
    missing: true,
    invalid: true,
    valid: true,
  });
  const assetsArray = useMemo(()=>{
    const assetsArray: Array<[string, { asset: PieceDefinition["assets"][number], files: Array<string> }]> = [];
    for(const [assetName, { asset, files }] of assets.entries()){
      const validCount = isValidAssetFileCount(asset.count, files.length);
      if(filters.valid && validCount) assetsArray.push([assetName, { asset, files }]);
      if(!validCount){
        if(filters.missing && files.length === 0) assetsArray.push([assetName, { asset, files }]);
        if(filters.invalid && files.length > 0) assetsArray.push([assetName, { asset, files }]);
      }
    }
    return assetsArray;
  }, [assets, filters])

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "row", gap: "1rem", flexWrap: "wrap" }}>
        <button onClick={() => setFilters({ missing: true, invalid: true, valid: true })}>Show All</button>
        <button onClick={() => setFilters({ ...filters, valid: !filters.valid })}>
          {filters.valid ? 'Hide ' : 'Show'}Valid
        </button>
        <button onClick={() => setFilters({ ...filters, missing: !filters.missing })}>
          <ToolTipSpan tip={missingFilesTT}>{filters.missing ? 'Hide ' : 'Show'}Missing</ToolTipSpan>
        </button>
        <button onClick={() => setFilters({ ...filters, invalid: !filters.invalid })}>
          <ToolTipSpan tip={invalidCountTT}>{filters.invalid ? 'Hide ' : 'Show'}Invalid</ToolTipSpan>
        </button>
      </div>
      <ul>
        {assetsArray.map(([assetName, { asset, files }], index) => {
          return (
            <li key={assetName}>
              <AssetItem assetName={assetName} asset={asset} files={files} />
            </li>
          )
        })}
      </ul>
      <FilesWithoutAssets files={files} />
    </div>
  )
}

function AssetItem(
  { assetName, asset, files }: {
    assetName: string,
    asset: PieceDefinition["assets"][number],
    files: Array<string>
  }
){
  const [displayFiles, setDisplayFiles] = useState(false);
  const validCount = isValidAssetFileCount(asset.count, files.length);
  if(files.length === 0 && !validCount){
    return <>
      <DisplayAssetInfo asset={asset} />
      <div className="error">No Files Matched</div>
    </>
  }
  if(!validCount){
    return <>
      <DisplayAssetInfo asset={asset} />
      <div className="error">Invalid File Count</div>
      <div>
        <button onClick={() => setDisplayFiles(!displayFiles)}>{displayFiles ? 'Hide' : 'Show'} Files</button>
        {displayFiles && <ul>{files.map((file, index) => (
          <li key={file}>{file}</li>
        ))}</ul>}
      </div>
    </>
  }
  return (
    <>
      <DisplayAssetInfo asset={asset} />
      <div className="success">Valid File Count</div>
      <div>
        <button onClick={() => setDisplayFiles(!displayFiles)}>{displayFiles ? 'Hide' : 'Show'} Files</button>
        {displayFiles && <ul>{files.map((file, index) => (
          <li key={file}>{file}</li>
        ))}</ul>}
      </div>
    </>
  )
}

function DisplayAssetInfo(
  { asset }: { asset: PieceDefinition["assets"][number] }
){
  return (
    <>
      <div>Asset Name: {asset.name}</div>
      <div>Type: {asset.classification}</div>
      {!Array.isArray(asset.count) ? (
        <div>Expected Count: {asset.count}</div>
      ) : (
        <div>Min Count: {asset.count[0]} - Max Count: {asset.count[1]}</div>
      )}
    </>
  )
}

function FilesWithoutAssets({ files }: { files: Awaited<ReturnType<typeof getAssetsOfFiles>>["filesWithAssets"] }){
  const filesWithoutAssets = useMemo(()=>{
    const invalidFiles: Array<string> = [];
    for(const [filePath, { assets }] of files){
      if(assets.length > 0) continue;
      invalidFiles.push(filePath);
    }
    return invalidFiles;
  }, [files])

  if(filesWithoutAssets.length === 0) return null;
  return (
    <div>
      <h3>Files Without Assets</h3>
      <ul>
        {filesWithoutAssets.map((filePath, index) => (
          <li key={index}>
            <div>{filePath}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}