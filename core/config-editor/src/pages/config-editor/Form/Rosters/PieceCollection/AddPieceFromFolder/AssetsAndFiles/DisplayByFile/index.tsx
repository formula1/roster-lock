import { useMemo, useState } from "react"
import { PieceDefinition } from "../../../types"
import { getAssetsOfFiles } from "@roster-lock/shared";

import { ToolTipSpan } from "../../../../../../../../components/ToolTip";
import missingFilesTT from "./missingFilesTT.md";
import multipleAssetsTT from "./multipleAssetsTT.md";

export function DisplayByFile(
  { assets, files }: {
    assets: Awaited<ReturnType<typeof getAssetsOfFiles>>["assetsWithFiles"],
    files: Awaited<ReturnType<typeof getAssetsOfFiles>>["filesWithAssets"]
  }
){

  const [filters, setFilters] = useState({
    missing: true,
    multiple: true,
    single: true,
  });
  const filesArray = useMemo(()=>{
    const filesArray: Array<[string, { assets: Array<PieceDefinition["assets"][number]> }]> = [];
    for(const [assetName, { assets, }] of files.entries()){
      if(filters.single && assets.length === 1) filesArray.push([assetName, { assets }]);
      if(filters.multiple && assets.length > 1) filesArray.push([assetName, { assets }]);
      if(filters.missing && assets.length === 0) filesArray.push([assetName, { assets }]);
    }
    return filesArray;
  }, [assets])

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "row", gap: "1rem", flexWrap: "wrap" }}>
        <button onClick={() => setFilters({ missing: true, multiple: true, single: true })}>Show All</button>
        <button onClick={() => setFilters({ ...filters, single: !filters.single })}>
          {filters.single ? 'Hide ' : 'Show'}Single Match
        </button>
        <button onClick={() => setFilters({ ...filters, multiple: !filters.multiple })}>
          <ToolTipSpan tip={multipleAssetsTT}>{filters.multiple ? 'Hide ' : 'Show'}Multiple Matches</ToolTipSpan>
        </button>
        <button onClick={() => setFilters({ ...filters, missing: !filters.missing })}>
          <ToolTipSpan tip={missingFilesTT}>{filters.missing ? 'Hide ' : 'Show'}Missing</ToolTipSpan>
        </button>
      </div>
      <ul>
        {filesArray.map(([filePath, { assets }], index) => {
          return (
            <li key={filePath}>
              <FileItem filePath={filePath} assets={assets} />
            </li>
          )
        })}
      </ul>
      <AssetsMissingFiles assets={assets} />
    </div>
  )
}

function FileItem(
  { filePath, assets }: {
    filePath: string,
    assets: Array<PieceDefinition["assets"][number]>,
  }
){
  const [displayAssets, setDisplayAssets] = useState(false);
  if(assets.length === 0){
    return <>
      <div>File path: {filePath}</div>
      <div className="error">No Assets Matched</div>
    </>
  }
  if(assets.length > 1){
    return <>
      <div>File path: {filePath}</div>
      <div>Asset: {assets[0].name}</div>
      <div className="warning">Multiple Assets Matchned</div>
      <div>
        <button onClick={() => setDisplayAssets(!displayAssets)}>{displayAssets ? 'Hide' : 'Show'} Assets</button>
        {displayAssets && <ul>{assets.map((asset, index) => (
          <li key={asset.name}>{asset.name}</li>
        ))}</ul>}
      </div>
    </>
  }
  return (
    <li>
      <div>File path: {filePath}</div>
      <div>Asset: {assets[0].name}</div>
    </li>
  )
}

function AssetsMissingFiles({ assets }: { assets: Awaited<ReturnType<typeof getAssetsOfFiles>>["assetsWithFiles"] }){
  const assetsWithoutFiles = useMemo(()=>{
    const invalidAssets: Array<PieceDefinition["assets"][number]> = [];
    for(const [assetName, { asset, files }] of assets){
      if(files.length > 0) continue;
      invalidAssets.push(asset);
    }
    return invalidAssets;
  }, [assets])

  if(assetsWithoutFiles.length === 0) return null;
  return (
    <div>
      <h3>Assets Without Files</h3>
      <ul>
        {assetsWithoutFiles.map((asset, index) => (
          <li key={index}>
            <div>{asset.name}</div>
          </li>
        ))}
      </ul>
    </div>
  )

}
