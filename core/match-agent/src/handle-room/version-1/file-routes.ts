
import { RosterLockV1Config, RosterLockPiece } from "@roster-lock/types";
import { jsonBody, HTTPRequestHandler, HTTPError } from "../../utils/http-router";
import { V1Env } from "./globals/types";
import z, { ZodType } from "zod";

import { engineCaster, pieceFileInfoCaster } from "./schema/lock";
import { pipeline } from "node:stream/promises";
import { mimeTypeFor } from "../../utils/fs";

type GetPieceInfo = {
  engine: RosterLockV1Config["engine"]
  pieceType: string
  piece: Pick<RosterLockPiece, "version" | "pathVariables">
}

const getAssetSchema: ZodType<(
  & GetPieceInfo
  & { assetName: string }
)> = z.object({
  engine: engineCaster,
  pieceType: z.string(),
  piece: pieceFileInfoCaster,
  assetName: z.string(),
})

export const getFilesOfAsset: HTTPRequestHandler = async function (this: V1Env, { req, res }){
  const { fileDB } = this;
  const body = await jsonBody(req)
  const parsedValue = getAssetSchema.safeParse(body);
  if(!parsedValue.success){
    throw new HTTPError(400, "Bad Form", parsedValue.error);
  }
  const { engine, pieceType, piece, assetName } = parsedValue.data;
  const files = [];
  for await (const filePath of fileDB.getFilesofAsset(
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
  engine: engineCaster,
  pieceType: z.string(),
  piece: pieceFileInfoCaster,
  filePath: z.string(),
})
export const getPieceFileContents: HTTPRequestHandler = async function (this: V1Env, { req, res }){
  const { fileDB } = this;
  const body = await jsonBody(req)
  const parsedValue = getContentsSchema.safeParse(body);
  if(!parsedValue.success){
    throw new HTTPError(400, "Bad Form", parsedValue.error);
  }
  const { engine, pieceType, piece, filePath } = parsedValue.data;
  const stream = await fileDB.getPieceFileContents(
    engine, pieceType, piece, filePath
  );
  res.setHeader("Content-Type", mimeTypeFor(filePath));
  await pipeline(stream, res);
}
