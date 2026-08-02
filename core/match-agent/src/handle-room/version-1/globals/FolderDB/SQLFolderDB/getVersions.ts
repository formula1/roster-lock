
import { RosterLockV1Config } from "@roster-lock/types";
import { calculatePieceVersion, calculateMediaOverrideVersion, getAssetsOfFiles, getAssetsOfFilesForOverride } from "@roster-lock/shared";
import { getFilesFromFolder } from "../../../../../utils/fs";

type PieceDefinition = RosterLockV1Config["engine"]["pieceDefinitions"][string];

export async function getDownloadSourceVersion(
  folder: string,
  pathVariables: Record<string, string>,
  pieceDefinition: PieceDefinition,
){
  const { filesWithAssets } = await getAssetsOfFiles(
    getFilesFromFolder(folder), pathVariables, pieceDefinition
  );
  return calculatePieceVersion(
    filesWithAssets, (relativePath) => getFileFromRoot(folder, relativePath)
  );
}

export async function getMediaOverrideDownloadSourceVersion(
  folder: string,
  pathVariables: Record<string, string>,
  pieceDefinition: PieceDefinition,
  assetNames: Array<string>,
){
  const { filesWithAssets, errors } = await getAssetsOfFilesForOverride(
    getFilesFromFolder(folder), pathVariables, pieceDefinition, new Set(assetNames)
  );
  if(errors.length > 0){
    throw new Error(`Downloaded media override contains unexpected files: ${errors.map((e)=>e.id).join(", ")}`);
  }
  return calculateMediaOverrideVersion(
    filesWithAssets, (relativePath) => getFileFromRoot(folder, relativePath)
  );
}

import { join as pathJoin, relative as pathRelative, sep as pathSep } from "node:path";

import { stat as fsStat } from "node:fs/promises";
import { createReadStream } from "node:fs";
async function getFileFromRoot(
  root: string, relativePath: string
): Promise<{ byteSize: number, stream: AsyncIterable<Uint8Array> }> {
  const filePath = pathJoin(root, relativePath);
  const stats = await fsStat(filePath);
  return { byteSize: stats.size, stream: createReadStream(filePath) } ;
}
