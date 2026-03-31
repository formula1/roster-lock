
import { MatchLockPublishPiece } from "@match-lock/shared";
import { join as pathJoin } from "node:path";
import { stat as fsStat, readFile as fsReadFile } from "node:fs/promises";
import { JSON_Unknown } from "@match-lock/shared/src/utils/JSON";

import {
  Object as ObjectCaster,
  String as StringCaster,
  Union as UnionCaster,
  Literal as LiteralCaster,
} from "runtypes";

const AssetConfigCaster = ObjectCaster({
  pieceId: StringCaster,
  authorId: StringCaster,
  version: StringCaster,
  assetType: UnionCaster(
    LiteralCaster("logic"),
    LiteralCaster("media"),
  )
})

export async function isUpToDate(
  piece: MatchLockPublishPiece,
  assetFolder: string
){
  const stat = await fsExists(assetFolder);
  if(!stat) return false;
  if(!stat.isDirectory()){
    throw new Error("File exists where an asset folder should be");
  }
  const assetConfigPath = pathJoin(assetFolder, "publish.matchlock.json");
  const assetConfig = await fsExists(assetConfigPath);
  if(!assetConfig){
    throw new Error("Folder exists but is not fully configured");
  }
  if(assetConfig.isDirectory()){
    throw new Error("File exists where an asset config should be");
  }
  const contents = await readJSON(assetConfigPath);

  if(!AssetConfigCaster.guard(contents)){
    throw new Error("Asset Config is not valid");
  }

  if(contents.pieceId !== piece.id){
    throw new Error("Asset Config is not valid");
  }
  if(contents.authorId !== piece.authorId){
    throw new Error("Asset Config is not valid");
  }
  if(contents.version !== assetBundle.version){
    throw new Error("Asset Config is not valid");
  }
  if(contents.assetType !== assetBundle.type){
    throw new Error("Asset Config is not valid");
  }

  return true;
}

async function fsExists(path: string){
  try {
    return await fsStat(path);
  }catch(e){
    return false;
  }
}

async function readJSON(path: string): Promise<JSON_Unknown>{
  const contents = await fsReadFile(path, "utf8");
  try {
    return JSON.parse(contents);
  }catch(e){
    throw new Error("Asset Config is not valid JSON");
  }
}
