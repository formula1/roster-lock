
import { RosterLockV1Config } from "@roster-lock/types";
import { calculatePieceVersion, getAssetsOfFiles } from "@roster-lock/shared";

type PieceDefinition = RosterLockV1Config["engine"]["pieceDefinitions"][string];

export async function getDownloadSourceVersion(
  folder: string,
  pathVariables: Record<string, string>,
  pieceDefinition: PieceDefinition,
){
  const { filesWithAssets } = await getAssetsOfFiles(
    walkRelative(folder), pathVariables, pieceDefinition
  );
  return calculatePieceVersion(
    filesWithAssets, (relativePath) => getFileFromRoot(folder, relativePath)
  );
}

import { readdir } from "node:fs/promises";
import { join as pathJoin, relative as pathRelative, sep as pathSep } from "node:path";
// getAssetsOfFiles matches file paths against each asset's glob (e.g.
// "media/particles.json"), which is relative to the piece folder root -
// so these must be yielded relative, not absolute.
async function* walkRelative(root: string): AsyncIterable<string>{
  yield* walkDirectory(root, root);
}
async function* walkDirectory(root: string, dir: string): AsyncIterable<string>{
  const files = await readdir(dir, { withFileTypes: true })
  for(const file of files){
    const fullPath = pathJoin(dir, file.name);
    if(file.isDirectory()){
      yield* walkDirectory(root, fullPath);
    } else {
      yield pathRelative(root, fullPath).split(pathSep).join("/");
    }
  }
}

import { stat as fsStat } from "node:fs/promises";
import { createReadStream } from "node:fs";
async function getFileFromRoot(
  root: string, relativePath: string
): Promise<{ byteSize: number, stream: AsyncIterable<Uint8Array> }> {
  const filePath = pathJoin(root, relativePath);
  const stats = await fsStat(filePath);
  return { byteSize: stats.size, stream: createReadStream(filePath) } ;
}
