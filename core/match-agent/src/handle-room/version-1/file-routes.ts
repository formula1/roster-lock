
import { RosterLockV1Config, RosterLockPiece } from "@roster-lock/types";
import { jsonBody, HTTPRequestHandler, HTTPError } from "../../utils/http-router";
import { V1Env } from "./globals/types";
import { IFolderDB } from "./globals/FolderDB";
import z, { ZodType } from "zod";
import { getMatchingAssetsForFile } from "@roster-lock/shared";

import { engineCaster, pieceFileInfoCaster } from "./schema/lock";
import { pipeline } from "node:stream/promises";
import { mimeTypeFor } from "../../utils/fs";

type GetPieceInfo = {
  engine: RosterLockV1Config["engine"]
  pieceType: string
  piece: Pick<RosterLockPiece, "version" | "pathVariables">
  // Full set of mediaOverride hashes active for this piece's selection - we
  // figure out here which one (if any) actually covers the requested
  // asset/file, rather than trusting the caller to have pre-resolved it.
  mediaOverrides?: Array<string>
}

const mediaOverrideHashesSchema = z.array(z.string()).optional();

const getAssetSchema: ZodType<(
  & GetPieceInfo
  & { assetName: string }
)> = z.object({
  engine: engineCaster,
  pieceType: z.string(),
  piece: pieceFileInfoCaster,
  assetName: z.string(),
  mediaOverrides: mediaOverrideHashesSchema,
})

export const getFilesOfAsset: HTTPRequestHandler = async function (this: V1Env, { req, res }){
  const { fileDB } = this;
  const body = await jsonBody(req)
  const parsedValue = getAssetSchema.safeParse(body);
  if(!parsedValue.success){
    throw new HTTPError(400, "Bad Form", parsedValue.error);
  }
  const { engine, pieceType, piece, assetName, mediaOverrides } = parsedValue.data;

  const overrideFiles = await findOverrideAssetFiles(
    fileDB, engine, pieceType, piece, mediaOverrides ?? [], assetName
  );
  const files = overrideFiles ?? await collectAsyncIterable(
    fileDB.getFilesofAsset(engine, pieceType, piece, assetName)
  );

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(files));
}


const getContentsSchema: ZodType<(
  & GetPieceInfo
  & { filePath: string }
)> = z.object({
  engine: engineCaster,
  pieceType: z.string(),
  piece: pieceFileInfoCaster,
  filePath: z.string(),
  mediaOverrides: mediaOverrideHashesSchema,
})
export const getPieceFileContents: HTTPRequestHandler = async function (this: V1Env, { req, res }){
  const { fileDB } = this;
  const body = await jsonBody(req)
  const parsedValue = getContentsSchema.safeParse(body);
  if(!parsedValue.success){
    throw new HTTPError(400, "Bad Form", parsedValue.error);
  }
  const { engine, pieceType, piece, filePath, mediaOverrides } = parsedValue.data;

  const overrideHash = await findOverrideForFilePath(
    fileDB, engine, pieceType, piece, mediaOverrides ?? [], filePath
  );
  const stream = overrideHash
    ? await fileDB.getMediaOverrideFileContents(engine, pieceType, piece.version.logic, overrideHash, filePath)
    : await fileDB.getPieceFileContents(engine, pieceType, piece, filePath);

  res.setHeader("Content-Type", mimeTypeFor(filePath));
  await pipeline(stream, res);
}

// Tries each active override in order, returning the first one whose
// downloaded folder actually has files for `assetName` - an override that
// doesn't declare this asset (or has no matching files) simply isn't the one
// covering it, and we fall through to the base piece's own files. A
// candidate erroring out (not downloaded, unknown, ...) is treated the same
// as "no match" rather than failing the whole request - by the time a
// client asks for files, every override it references should already be
// fully downloaded (the download step gates this), so an error here means
// this candidate just isn't the one covering the requested asset.
async function findOverrideAssetFiles(
  fileDB: IFolderDB,
  engine: RosterLockV1Config["engine"],
  pieceType: string,
  piece: Pick<RosterLockPiece, "version" | "pathVariables">,
  overrideHashes: Array<string>,
  assetName: string,
): Promise<Array<string> | undefined> {
  for(const hash of overrideHashes){
    try {
      const files = await collectAsyncIterable(fileDB.getMediaOverrideFilesOfAsset(
        engine, pieceType, piece.version.logic, hash, piece.pathVariables, assetName
      ));
      if(files.length > 0) return files;
    }catch{
      // Doesn't apply to this asset (or isn't ready) - try the next candidate.
    }
  }
  return undefined;
}

// Same idea as findOverrideAssetFiles, but for a single known filePath: first
// figure out which asset that path belongs to (the same glob-matching the
// base piece's own file resolution uses), then check whether any active
// override actually has files for that asset.
async function findOverrideForFilePath(
  fileDB: IFolderDB,
  engine: RosterLockV1Config["engine"],
  pieceType: string,
  piece: Pick<RosterLockPiece, "version" | "pathVariables">,
  overrideHashes: Array<string>,
  filePath: string,
): Promise<string | undefined> {
  if(overrideHashes.length === 0) return undefined;
  const pieceDefinition = engine.pieceDefinitions[pieceType];
  const assetName = getMatchingAssetsForFile(pieceDefinition, piece.pathVariables, filePath)[0]?.name;
  if(!assetName) return undefined;

  for(const hash of overrideHashes){
    try {
      const files = await collectAsyncIterable(fileDB.getMediaOverrideFilesOfAsset(
        engine, pieceType, piece.version.logic, hash, piece.pathVariables, assetName
      ));
      if(files.length > 0) return hash;
    }catch{
      // Doesn't apply to this asset (or isn't ready) - try the next candidate.
    }
  }
  return undefined;
}

async function collectAsyncIterable<T>(iterable: AsyncIterable<T>): Promise<Array<T>> {
  const items: Array<T> = [];
  for await (const item of iterable) items.push(item);
  return items;
}
