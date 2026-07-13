
import { RosterLockV1Config, RosterLockPiece } from "@roster-lock/types";
import { jsonBody, HTTPRequestHandler, HTTPError } from "../../utils/http-router";
import { getSQLite3FolderDB } from "./globals/FolderDB";
import z, { ZodType } from "zod";

import { engineCaster, pieceCaster } from "./schema/lock";
import { pipeline } from "node:stream/promises";
import { mimeTypeFor } from "../../utils/fs";

type GetPieceInfo = {
  folder: string,
  engine: RosterLockV1Config["engine"]
  pieceType: string
  piece: RosterLockPiece
}

const getAssetSchema: ZodType<(
  & GetPieceInfo
  & { assetName: string }
)> = z.object({
  folder: z.string(),
  engine: engineCaster,
  pieceType: z.string(),
  piece: pieceCaster,
  assetName: z.string(),
})

export const getFilesOfAsset: HTTPRequestHandler = async function ({ req, res }){
  const body = await jsonBody(req)
  const parsedValue = getAssetSchema.safeParse(body);
  if(!parsedValue.success){
    throw new HTTPError(400, "Bad Form", parsedValue.error);
  }
  const { folder, engine, pieceType, piece, assetName } = parsedValue.data;
  const db = getSQLite3FolderDB(folder);
  const files = [];
  for await (const filePath of db.getFilesofAsset(
    engine, pieceType, piece, assetName
  )){
    files.push(filePath)
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(files));
}


const getContentsSchema: ZodType<(
  & GetPieceInfo
  & { filePath: string }
)> = z.object({
  folder: z.string(),
  engine: engineCaster,
  pieceType: z.string(),
  piece: pieceCaster,
  filePath: z.string(),
})
export const getPieceFileContents: HTTPRequestHandler = async function ({ req, res }){
  const body = await jsonBody(req)
  const parsedValue = getContentsSchema.safeParse(body);
  if(!parsedValue.success){
    throw new HTTPError(400, "Bad Form", parsedValue.error);
  }
  const { folder, engine, pieceType, piece, filePath } = parsedValue.data;
  const db = getSQLite3FolderDB(folder);
  const stream = await db.getPieceFileContents(
    engine, pieceType, piece, filePath
  );
  res.setHeader("Content-Type", mimeTypeFor(filePath));
  await pipeline(stream, res);
}
