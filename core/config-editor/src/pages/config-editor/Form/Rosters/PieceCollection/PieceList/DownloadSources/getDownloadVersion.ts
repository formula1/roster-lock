
import { ROSTERLOCK_SIDECAR } from "../../../../../../../globals/side-car";
import { FS } from "../../../../../../../globals/fs";
import { tempDir } from '@tauri-apps/api/path';
import { mkdir, remove as FSRemove } from '@tauri-apps/plugin-fs';


import { getAssetsOfFiles, calculatePieceVersion } from "@roster-lock/shared";
import { PieceDefinition } from "../../types";

export async function getDownloadSourceVersion(
  source: string,
  pathVariables: Record<string, string>,
  pieceDefinition: PieceDefinition
){
  const temp = await tempDir();
  const uniqueDir = `${temp}/roster-lock-${crypto.randomUUID()}`;
  await mkdir(uniqueDir, { recursive: true });

  try {
    await ROSTERLOCK_SIDECAR.downloadSource(source, uniqueDir);

    const files: Map<string, { size: number, relativePath: string }> = new Map();
    for await (const fileResult of FS.walkDirStream(uniqueDir)){
      if(!fileResult.is_file) continue;
      files.set(fileResult.path, { size: fileResult.size, relativePath: fileResult.relative_path });
    }

    const assetsOfFiles = await getAssetsOfFiles(files.keys(), pathVariables, pieceDefinition);

    return await calculatePieceVersion(
      assetsOfFiles.filesWithAssets,
      async (path)=>{
        const stat = await FS.stat(path);
        return { byteSize: stat.size, stream: FS.getFileStream(path) };
      }
    );

  }finally{
    try {
      await FSRemove(uniqueDir, { recursive: true });
    }catch(e){
      alert("Failed To Clean Up Temp Dir:\n\n" + (e as Error).message);
    }
  }
}

