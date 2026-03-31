
import { MatchLockPublishPiece } from "@match-lock/shared";
import { resolveCompression } from "@match-lock/shared";
import { resolveStream } from "../../tools/download-methods";
import { join as pathJoin } from "node:path";

type ProgressListener = (value: { pieceId: string, part: "logic" | "media", progress: number })=>any

export async function availableGamePiece(
  piece: MatchLockPublishPiece, parentFolder: string, onProgress: ProgressListener
){
  const pieceFolder = resolvePieceFolder(piece, parentFolder);
  if(!)
  if(await isUpToDate(piece, piece.logic, pathJoin(pieceFolder, "logic"))){
    return pieceFolder;
  }
  return await Promise.all([
    handleAsset(piece, pieceFolder, piece.logic, "logic", onProgress),
    handleAsset(piece, pieceFolder, piece.media, "media", onProgress),
  ]);
}

function resolvePieceFolder(piece: MatchLockPublishPiece, parentFolder: string){
  return pathJoin(parentFolder, piece.author, piece.version.logic);
}

import { mkdir as fsMkdir, rm as fsRm } from "node:fs/promises";
import { isUpToDate } from "./isUpToDate";
import { pipeline } from "node:stream/promises";
import { x as tarExtract } from "tar";

async function handleAsset(
  piece: MatchLockPublishPiece,
  pieceFolder: string,
  assetBundle: MatchLockAssetBundle,
  assetType: "logic" | "media",
  onProgress: ProgressListener
){
  if(assetType !== assetBundle.type){
    throw new Error("Asset Type Mismatch");
  }
  const assetFolder = pathJoin(pieceFolder, `${assetType}-${assetBundle.version.toString()}`);
  if(await isUpToDate(piece, assetBundle, assetFolder)){
    return assetFolder;
  }
  const assetSource = await resolveStream(assetBundle);
  const fileInfo = new FileInfo((progress)=>(onProgress({
    pieceId: piece.id,
    part: assetType,
    progress,
  })));
  const decompressor = resolveCompression(assetSource.filename).createDecompressor();

  try {
    await fsMkdir(assetFolder, { recursive: true });
    await pipeline(
      assetSource.stream,
      fileInfo,
      decompressor,
      tarExtract({ cwd: assetFolder }),
    )

    if(fileInfo.byteSize !== assetBundle.sizeBytes){
      throw new Error("Asset Size Mismatch");
    }
    if(fileInfo.hash !== assetBundle.sha256){
      throw new Error("Asset Hash Mismatch");
    }
    if(!await isUpToDate(piece, assetBundle, assetFolder)){
      throw new Error("Asset Not Up To Date");
    }

    return assetFolder;

  }catch(e){
    try {
      await fsRm(assetFolder, { recursive: true, force: true });
    }catch(e){
      console.log("Failed To Clean Up Asset Folder", e);
    }
    throw new Error("Failed To Download Asset");
  }
}


import { createHash } from 'crypto';
import { Transform } from "node:stream";
class FileInfo extends Transform {
  private hasher = createHash("sha256");
  public hash = "";
  public byteSize = 0;
  constructor(
    private progressListener: (progress: number)=>any,
  ){
    super({ readableObjectMode: false, writableObjectMode: false });
  }

  _transform(chunk: Buffer, encoding: string, callback: (err?: Error, data?: Buffer)=>any) {
    this.byteSize += chunk.length;
    this.hasher.update(chunk);
    this.progressListener(this.byteSize);
    callback(void 0, chunk);
  }
  _flush(callback: (err?: Error, data?: Buffer)=>any) {
    this.hash = this.hasher.digest("hex");
    callback();
  }
}

