import { usePromisedMemo } from "../../../../../../utils/react";
import { PieceDefinition, PieceValue } from "../../types";
import { getAssetsOfFiles, collectAssetFileErrors } from "@roster-lock/shared";

import { PageArrayTabs } from "../../../../../../components/Tabs";
import { DisplayByFile } from "./DisplayByFile";
import { DisplayByAssets } from "./DisplayByAssets";

import { useEffect } from "react";
import { type WalkDir } from "../../../../../../globals/Host";
import { type PieceSource } from "../source";

export type AssetsAndFilesValue = (
  & Awaited<ReturnType<typeof getAssetsOfFiles>>
  & { errors: ReturnType<typeof collectAssetFileErrors> }
);

export function AssetsAndFiles(
  { source, pathVariables, pieceDefinition, onChange }: {
    source: PieceSource,
    pathVariables: Record<string, string>,
    pieceDefinition: PieceDefinition,
    onChange: (v: null | AssetsAndFilesValue)=>unknown,
  }
){
  const assetsAndFiles = usePromisedMemo(async ()=>{
    const files = relativePathsOf(source.entries);
    const { assetsWithFiles, filesWithAssets } = await getAssetsOfFiles(
      files, pathVariables, pieceDefinition
    );
    const errors = collectAssetFileErrors({ assetsWithFiles, filesWithAssets });
    return { assetsWithFiles, filesWithAssets, errors };
  }, [source, pathVariables, pieceDefinition])

  useEffect(()=>{
    if(assetsAndFiles.status !== "success"){
      onChange(null);
    } else {
      onChange(assetsAndFiles.value);
    }
  }, [assetsAndFiles])

  if(assetsAndFiles.status === "failed"){
    return <div className="error">
      <h3>Failed to load assets and files</h3>
      <pre>{JSON.stringify(assetsAndFiles.error, null, 2)}</pre>
    </div>
  }
  if(assetsAndFiles.status === "pending") return <div>Loading...</div>

  return (
    <>
      <PageArrayTabs
        pages={[
          {
            title: 'Display By Files',
            content: (
              <DisplayByFile
                assets={assetsAndFiles.value.assetsWithFiles}
                files={assetsAndFiles.value.filesWithAssets}
              />
            )
          },
          {
            title: 'Display By Assets',
            content: (
              <DisplayByAssets
                assets={assetsAndFiles.value.assetsWithFiles}
                files={assetsAndFiles.value.filesWithAssets}
              />
            )
          },
        ]}
      />
    </>
  )
}

async function* relativePathsOf(entries: WalkDir): AsyncIterable<string> {
  for await (const entry of entries){
    yield entry.relativePath;
  }
}
