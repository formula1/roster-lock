import { DownloadResult, RosterLockPiece, RosterLockV1Config, RosterLockDownloadUpdate } from "@roster-lock/types";
import { ROSTERLOCK_MATCH_AGENT_URL } from "../constants/match-agent";
import { runFetch } from "../utils/fetch";
import WebSocket from "isomorphic-ws";
import { MessageBridge, waitForBridgeEvent } from "@roster-lock/utils";

type GetPieceInfo = {
  version: 1,
  engine: RosterLockV1Config["engine"]
  pieceType: string
  piece: RosterLockPiece
}

export async function ensurePieceDownloaded(
  {
    version,
    engine,
    pieceType,
    piece,
  }: GetPieceInfo,
  matchAgentAuth: string,
  matchAgentUrl: string | URL = ROSTERLOCK_MATCH_AGENT_URL,
){
  if(version !== 1) throw new Error(`Unsupported Version ${version}`);
  const url = new URL("/v1/piece", matchAgentUrl);
  const response = await runFetch(matchAgentAuth, url, {
    method: "PUT",
    body: {
      engine, pieceType, piece
    }
  })
  
  return await response.json() as DownloadResult;
}

export async function ensurePieceDownloadedOverWebSocket(
  {
    version,
    engine,
    pieceType,
    piece,
  }: GetPieceInfo,
  matchAgentAuth: string,
  onProgress?: (update: RosterLockDownloadUpdate) => void,
  matchAgentUrl: string | URL = ROSTERLOCK_MATCH_AGENT_URL,
){
  if(version !== 1) throw new Error(`Unsupported Version ${version}`);
  const url = new URL("/v1/piece/ensure", matchAgentUrl);
  if(!["http:", "https:"].includes(url.protocol)){
    throw new Error("Expecting The match agent url to be http or https");
  }
  url.protocol = url.protocol === "https:" ? "wss:" : "ws";
  url.searchParams.set("authorization", matchAgentAuth);

  const ws = new WebSocket(url.href);
  const bridge = new MessageBridge((message)=>ws.send(JSON.stringify(message)));
  ws.on("message", (message)=>{
    bridge.handleMessage(JSON.parse(message.toString()));
  });

  bridge.onEvent("download-progress", (update)=>{
    onProgress?.(update);
  });

  try {
    await waitForBridgeEvent(bridge, "ready", 10_000);

    return await bridge.sendRequest(
      "ensure-piece", { engine, pieceType, piece }
    ) as DownloadResult;

  }finally{
    ws.close();
  }
}

type ListPiecesConfig = {
  version: 1,
  rosterConfig: RosterLockV1Config,
  pieceType: string,
}

export async function listDownloadedPiecesFromConfig(
  {
    version, rosterConfig, pieceType
  }: ListPiecesConfig,
  pagination: { page: number, limit: number },
  matchAgentAuth: string,
  matchAgentUrl: string | URL = ROSTERLOCK_MATCH_AGENT_URL,
){
  if(version !== 1) throw new Error(`Unsupported Version ${version}`);
  const roster = rosterConfig.rosters[pieceType];
  if(!roster) throw new Error(`Invalid pieceType, missing roster: ${pieceType}`);

  return listDownloadedPiecesDirect(
    {
      version,
      engineName: rosterConfig.engine.name,
      pieceType,
      logicIds: roster.map((piece)=>(piece.version.logic)),
    },
    pagination,
    matchAgentAuth,
    matchAgentUrl,
  );
}

type ListPiecesDirect = {
  version: 1,
  engineName: string,
  pieceType: string,
  logicIds: Array<string>
}

export async function listDownloadedPiecesDirect(
  {
    version, engineName, pieceType, logicIds
  }: ListPiecesDirect,
  { page, limit }: { page: number, limit: number },
  matchAgentAuth: string,
  matchAgentUrl: string | URL = ROSTERLOCK_MATCH_AGENT_URL,
){
  if(version !== 1) throw new Error(`Unsupported Version ${version}`);
  const url = new URL(`/v1/piece/list-downloaded/direct`, matchAgentUrl);
  url.searchParams.set("page", page.toString());
  url.searchParams.set("limit", limit.toString());

  const response = await runFetch(matchAgentAuth, url, {
    method: "QUERY",
    body: {
      engineName, pieceType, logicIds
    }
  })
  
  return await response.json() as Array<Pick<RosterLockPiece, "version" | "pathVariables">>;
}
