
import { calculatePieceVersion, getAssetsOfFiles, RosterLockV1Config } from "@match-lock/shared";

type PieceDefinition = RosterLockV1Config["engine"]["pieceDefinitions"][string];

export async function getDownloadSourceVersion(
  folder: string,
  pathVariables: Record<string, string>,
  pieceDefinition: PieceDefinition,
){
  const { filesWithAssets } = await getAssetsOfFiles(
    walkDirectory(folder), pathVariables, pieceDefinition
  );
  return calculatePieceVersion(
    filesWithAssets, getFile
  );
}

import { readdir } from "node:fs/promises";
import { join as pathJoin } from "node:path";
async function* walkDirectory(folder: string): AsyncIterable<string>{
  const files = await readdir(folder, { withFileTypes: true })
  for(const file of files){
    if(file.isDirectory()){
      yield* walkDirectory(pathJoin(folder, file.name));
    } else {
      yield pathJoin(folder, file.name);
    }
  }
}

import { stat as fsStat } from "node:fs/promises";
import { createReadStream } from "node:fs";
async function getFile(filePath: string): Promise<{ byteSize: number, stream: AsyncIterable<Uint8Array> }> {
  const stats = await fsStat(filePath);
  return { byteSize: stats.size, stream: createReadStream(filePath) } ;
}
