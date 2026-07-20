
import { RosterLockPiece, RosterLockV1Config, DownloadResult } from "@roster-lock/types";
import { jsonBody, HTTPRequestHandler, HTTPError } from "../../utils/http-router";
import { handlePagination } from "../../utils/pagination"
import z, { ZodType } from "zod";
import { engineCaster, pieceCaster } from "./schema/lock";
import { V1Env } from "./globals/types";

type GetPieceInfo = {
  engine: RosterLockV1Config["engine"]
  pieceType: string
  piece: RosterLockPiece
}

const ensurePieceSchema: ZodType<GetPieceInfo> = z.object({
  engine: engineCaster,
  pieceType: z.string(),
  piece: pieceCaster,
})

export const ensurePieceDownloaded: HTTPRequestHandler = async function(
  this: V1Env, { req, res }
){
  const { fileDB } = this;
  const body = await jsonBody(req)
  const parseResult = ensurePieceSchema.safeParse(body);
  if(!parseResult.success){
    throw new HTTPError(400, "Bad Form", parseResult.error);
  }
  const { engine, pieceType, piece } = parseResult.data;

  const abortController = new AbortController();
  req.on("close", ()=>abortController.abort());

  const pieceFolder = await fileDB.ensurePieceExists(
    engine, pieceType, piece, {
      onProgress: ()=>{},
      abortSignal: abortController.signal,
    }
  );

  const dlResult: DownloadResult = {
    pieceType,
    pieceId: piece.id,
    pieceVersions: { logic: piece.version.logic, media: piece.version.media },
    folder: pieceFolder,
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(dlResult));
}


type ListDownloadedPiecesDirect = {
  engineName: string,
  pieceType: string,
  logicIds: Array<string>,
}

const listPiecesDirectSchema: ZodType<ListDownloadedPiecesDirect> = z.object({
  engineName: z.string(),
  pieceType: z.string(),
  logicIds: z.array(z.string()),
})

export const listDownloadedPiecesDirect: HTTPRequestHandler = async function(
  this: V1Env, { req, res }, routeInfo
){
  const { fileDB } = this;
  const { page, limit } = handlePagination(routeInfo.url.searchParams);

  const body = await jsonBody(req)
  const parseResult = listPiecesDirectSchema.safeParse(body);
  if(!parseResult.success) throw new HTTPError(400, "Bad Form", parseResult.error);
  const config = parseResult.data;

  const pieces = await fileDB.listPieces(
    config.engineName,
    config.pieceType,
    config.logicIds,
    { page, limit }
  );
  res.writeHead(200, { "content-type": "application/json"});
  res.end(JSON.stringify(pieces));
}

